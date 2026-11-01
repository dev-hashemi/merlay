import * as vscode from 'vscode';
import { DIAGRAM_TEMPLATES } from '@merlay/core';
import { MERLAY_EDITOR_VIEW_TYPE } from './protocol';
import { MermaidEditorProvider } from './mermaidEditor';
import {
  EDIT_AT_CURSOR_COMMAND,
  EDIT_FENCE_COMMAND,
  SELECT_DIAGRAM_COMMAND,
  MermaidFenceCodeLensProvider,
  editDiagramAtCursor,
  handleUriFenceEdit,
  isPanelActive,
  openFenceEditor,
  selectDiagram,
} from './fenceLens';
import {
  findMermaidFences,
  findNearestFence,
  getEncodedQuery,
  parseEditFenceUri,
} from './fences';

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
    ),
    vscode.commands.registerCommand(EDIT_AT_CURSOR_COMMAND, () =>
      editDiagramAtCursor(context.extensionUri)
    ),
    vscode.commands.registerCommand(SELECT_DIAGRAM_COMMAND, () =>
      selectDiagram(context.extensionUri)
    ),
    vscode.window.onDidChangeTextEditorSelection((e) => {
      // If panel is not active, do not auto-open on normal keyboard typing or editor clicks
      if (
        !isPanelActive() &&
        (e.kind === vscode.TextEditorSelectionChangeKind.Keyboard ||
          e.kind === vscode.TextEditorSelectionChangeKind.Mouse)
      ) {
        return;
      }

      const doc = e.textEditor.document;
      if (doc.languageId !== 'markdown') return;
      const cursorLine = e.selections[0]?.active.line;
      if (cursorLine === undefined) return;
      const fences = findMermaidFences(doc.getText());
      if (fences.length === 0) return;

      const fence =
        fences.find((f) => cursorLine >= f.startLine && cursorLine <= f.endLine) ||
        (fences.length === 1 ? fences[0] : findNearestFence(fences, cursorLine));

      if (fence) {
        const isInside = cursorLine >= fence.startLine && cursorLine <= fence.endLine;
        const distance = isInside
          ? 0
          : Math.min(
              Math.abs(cursorLine - fence.startLine),
              Math.abs(cursorLine - fence.endLine)
            );
        if (isInside || distance <= 15 || fences.length === 1) {
          void openFenceEditor(context.extensionUri, doc.uri.toString(), fence.startLine);
        }
      }
    }),
    vscode.window.registerUriHandler({
      async handleUri(uri: vscode.Uri) {
        // Parse the encoded query from the URI string: `uri.query` is already
        // decoded, which loses separators inside file paths.
        const parsed = parseEditFenceUri(uri.path, getEncodedQuery(uri.toString()));
        if (parsed) {
          await handleUriFenceEdit(
            context.extensionUri,
            parsed.targetLine,
            parsed.targetFile,
            parsed.diagramIndex
          );
        }
      },
    })
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
