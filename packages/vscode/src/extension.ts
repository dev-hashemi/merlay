import * as vscode from 'vscode';
import { getWebviewHtml } from './webviewHtml';

/**
 * VS Code entry (scaffold for Phase 3).
 * Today: one command opening a Webview with the shared @merlay/core canvas.
 * Phase 3 adds: CustomEditor for .mmd files, markdown fence CodeLens,
 * and document sync over postMessage.
 */
export function activate(context: vscode.ExtensionContext): void {
  const openCmd = vscode.commands.registerCommand('merlay.openVisualEditor', () => {
    const panel = vscode.window.createWebviewPanel(
      'merlay.visualEditor',
      'Merlay',
      vscode.ViewColumn.Beside,
      { enableScripts: true, retainContextWhenHidden: true }
    );
    panel.webview.html = getWebviewHtml(panel.webview, context.extensionUri);
  });
  context.subscriptions.push(openCmd);
}

export function deactivate(): void {
  // No resources to dispose yet.
}
