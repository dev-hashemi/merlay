/**
 * Shared webview wiring for all visual panels (`.mmd` custom editor,
 * markdown fence panels). Owns the postMessage protocol on the host side:
 * init on ready, write-back on codeChange, live update on document edits,
 * theme pings on color-theme changes.
 */

import * as vscode from 'vscode';
import { getWebviewHtml } from './webviewHtml';
import type { HostToWebviewMessage, WebviewToHostMessage } from './protocol';

export interface VisualSource {
  readCode(): string;
  writeCode(code: string): Promise<void>;
}

interface VisualPanelBinding extends vscode.Disposable {
  publishSource(): void;
}

let nextBindingId = 0;

export function fullDocRange(document: vscode.TextDocument): vscode.Range {
  const lastLine = Math.max(document.lineCount - 1, 0);
  return new vscode.Range(0, 0, lastLine, document.lineAt(lastLine).text.length);
}

export function createVisualPanel(
  viewType: string,
  title: string,
  extensionUri: vscode.Uri
): vscode.WebviewPanel {
  const panel = vscode.window.createWebviewPanel(viewType, title, vscode.ViewColumn.Active, {
    enableScripts: true,
    retainContextWhenHidden: true,
  });
  panel.webview.html = getWebviewHtml(panel.webview, extensionUri);
  return panel;
}

/**
 * Wire a panel to one text document. Echo-safe: the webview ignores updates
 * whose code matches what it already shows, so our own write-back never loops.
 */
export function attachVisualPanel(
  panel: vscode.WebviewPanel,
  document: vscode.TextDocument,
  source: VisualSource
): VisualPanelBinding {
  const bindingId = ++nextBindingId;
  let saveChain = Promise.resolve();
  let pendingWrites = 0;
  let unsavedCode: string | undefined;
  let recoveredCode: string | undefined;
  let disposed = false;
  const post = (message: HostToWebviewMessage): void => {
    if (!disposed) void panel.webview.postMessage(message);
  };
  const openRecovery = async (code = unsavedCode): Promise<void> => {
    if (code === undefined || code === recoveredCode) return;
    recoveredCode = code;
    const recovery = await vscode.workspace.openTextDocument({ language: 'mermaid', content: code });
    await vscode.window.showTextDocument(recovery);
  };
  const reportSaveError = async (error: unknown, code?: string): Promise<void> => {
    const detail = error instanceof Error ? error.message : String(error);
    const recoveryHint = code === undefined
      ? 'Your edits are still in the visual editor.'
      : 'You can recover the edit from a copy.';
    const action = await vscode.window.showErrorMessage(
      `Could not save diagram: ${detail} ${recoveryHint}`,
      'Open recovery copy'
    );
    if (action) await openRecovery(code);
  };
  const syncSource = (): void => {
    if (pendingWrites || unsavedCode !== undefined) return;
    try {
      post({ type: 'merlay/update', code: source.readCode(), bindingId });
    } catch {
      // Keep the canvas intact if its target disappeared; saving reports it.
    }
  };
  const onMessage = panel.webview.onDidReceiveMessage((message: WebviewToHostMessage) => {
    if (disposed) return;
    if (message.type === 'merlay/ready') {
      post({ type: 'merlay/init', code: source.readCode(), bindingId });
    } else if (message.type === 'merlay/codeChange') {
      if (message.bindingId !== bindingId) {
        void reportSaveError(new Error('The visual editor switched diagrams.'), message.code);
        return;
      }
      unsavedCode = message.code;
      pendingWrites++;
      saveChain = saveChain.then(async () => {
        try {
          if (message.baseCode !== undefined && source.readCode().trim() !== message.baseCode.trim()) {
            throw new Error('The diagram changed outside the visual editor.');
          }
          await source.writeCode(message.code);
          if (pendingWrites === 1) unsavedCode = undefined;
        } catch (error: unknown) {
          void reportSaveError(error);
        } finally {
          pendingWrites--;
          if (disposed && !pendingWrites) await openRecovery();
          else syncSource();
        }
      });
    } else if (message.type === 'merlay/notify') {
      void vscode.window.showInformationMessage(message.message);
    }
  });
  const onDocChange = vscode.workspace.onDidChangeTextDocument((event) => {
    if (event.document.uri.toString() !== document.uri.toString()) return;
    syncSource();
  });
  const onTheme = vscode.window.onDidChangeActiveColorTheme(() => {
    post({ type: 'merlay/theme' });
  });
  return {
    publishSource: syncSource,
    dispose() {
      disposed = true;
      onMessage.dispose();
      onDocChange.dispose();
      onTheme.dispose();
      if (!pendingWrites) void openRecovery();
    },
  };
}
