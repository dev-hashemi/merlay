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

export function fullDocRange(document: vscode.TextDocument): vscode.Range {
  const lastLine = Math.max(document.lineCount - 1, 0);
  return new vscode.Range(0, 0, lastLine, document.lineAt(lastLine).text.length);
}

export function createVisualPanel(
  viewType: string,
  title: string,
  extensionUri: vscode.Uri
): vscode.WebviewPanel {
  const panel = vscode.window.createWebviewPanel(viewType, title, vscode.ViewColumn.Beside, {
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
): vscode.Disposable {
  const post = (message: HostToWebviewMessage): void => {
    void panel.webview.postMessage(message);
  };
  const onMessage = panel.webview.onDidReceiveMessage((message: WebviewToHostMessage) => {
    if (message.type === 'merlay/ready') {
      post({ type: 'merlay/init', code: source.readCode() });
    } else if (message.type === 'merlay/codeChange') {
      if (message.code === source.readCode()) return;
      void source.writeCode(message.code);
    } else if (message.type === 'merlay/notify') {
      void vscode.window.showInformationMessage(message.message);
    }
  });
  const onDocChange = vscode.workspace.onDidChangeTextDocument((event) => {
    if (event.document.uri.toString() !== document.uri.toString()) return;
    post({ type: 'merlay/update', code: source.readCode() });
  });
  const onTheme = vscode.window.onDidChangeActiveColorTheme(() => {
    post({ type: 'merlay/theme' });
  });
  return vscode.Disposable.from(onMessage, onDocChange, onTheme);
}
