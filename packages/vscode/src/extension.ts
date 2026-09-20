import * as vscode from 'vscode';
import { DIAGRAM_TEMPLATES } from '@merlay/core';
import { MERLAY_EDITOR_VIEW_TYPE } from './protocol';
import { MermaidEditorProvider } from './mermaidEditor';
import {
  EDIT_FENCE_COMMAND,
  MermaidFenceCodeLensProvider,
  openFenceEditor,
} from './fenceLens';

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(
      MERLAY_EDITOR_VIEW_TYPE,
      new MermaidEditorProvider(context.extensionUri),
      {
        webviewOptions: { retainContextWhenHidden: true },
        supportsMultipleEditorsPerDocument: true,
      }
    ),
    vscode.languages.registerCodeLensProvider(
      { language: 'markdown' },
      new MermaidFenceCodeLensProvider()
    ),
    vscode.commands.registerCommand('merlay.openVisualEditor', () => openNewDiagram()),
    vscode.commands.registerCommand(
      EDIT_FENCE_COMMAND,
      (uriString?: string, startLine?: number) =>
        openFenceEditor(context.extensionUri, uriString, startLine)
    )
  );
}

/** Create an untitled mermaid document and open it in the visual editor. */
async function openNewDiagram(): Promise<void> {
  const direction = vscode.workspace
    .getConfiguration('merlay')
    .get<string>('defaultDirection', 'LR');
  const fallback = DIAGRAM_TEMPLATES[0]?.defaultCode ?? 'flowchart LR\n    A --> B\n';
  const code = fallback.replace(/^flowchart\s+\w+/, `flowchart ${direction}`);
  const document = await vscode.workspace.openTextDocument({ language: 'mermaid', content: code });
  await vscode.commands.executeCommand('vscode.openWith', document.uri, MERLAY_EDITOR_VIEW_TYPE);
}

export function deactivate(): void {
  // No resources to dispose yet.
}
