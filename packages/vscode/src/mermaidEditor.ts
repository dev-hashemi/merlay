/**
 * Visual custom editor for standalone `.mmd` / `.mermaid` files.
 * The text document stays the source of truth; the webview canvas edits it
 * through WorkspaceEdits (undo/redo keep working via the document).
 */

import * as vscode from 'vscode';
import { attachVisualPanel, fullDocRange } from './panels';
import { getWebviewHtml } from './webviewHtml';

export class MermaidEditorProvider implements vscode.CustomTextEditorProvider {
  constructor(private readonly extensionUri: vscode.Uri) {}

  public async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    webviewPanel.webview.options = { enableScripts: true };
    webviewPanel.webview.html = getWebviewHtml(webviewPanel.webview, this.extensionUri);
    let savedCode = document.getText();
    const wiring = attachVisualPanel(webviewPanel, document, {
      readCode: () => {
        savedCode = document.getText();
        return savedCode;
      },
      writeCode: async (code: string) => {
        if (document.getText() !== savedCode) throw new Error('The diagram changed outside the visual editor.');
        const edit = new vscode.WorkspaceEdit();
        edit.replace(document.uri, fullDocRange(document), code);
        if (!(await vscode.workspace.applyEdit(edit))) throw new Error('The document could not be updated.');
        savedCode = code;
      },
    });
    webviewPanel.onDidDispose(() => {
      wiring.dispose();
    });
  }
}
