/**
 * Markdown ```mermaid fence integration: a CodeLens above every fence opens
 * a visual panel bound to that block. Write-back reuses core's
 * `replaceMermaidBlock` (fence-aware, auto-healing) with a moving anchor,
 * mirroring the Obsidian block modal's save chain.
 *
 * Implements single-panel reuse per workspace, multi-diagram navigation,
 * context-menu / cursor command fallback, and URI handler dispatch for
 * the Markdown preview overlay.
 */

import * as vscode from 'vscode';
import { replaceMermaidBlock } from '@merlay/core';
import { findMermaidFences, findNearestFence, formatFenceTitle, type MermaidFence } from './fences';
import { attachVisualPanel, createVisualPanel, fullDocRange } from './panels';
import { MERLAY_EDITOR_VIEW_TYPE } from './protocol';

export const EDIT_FENCE_COMMAND = 'merlay.editMermaidFence';
export const EDIT_AT_CURSOR_COMMAND = 'merlay.editDiagramAtCursor';
export const SELECT_DIAGRAM_COMMAND = 'merlay.selectDiagram';

export class MermaidFenceCodeLensProvider implements vscode.CodeLensProvider {
  public provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    return findMermaidFences(document.getText()).map(
      (fence) =>
        new vscode.CodeLens(new vscode.Range(fence.startLine, 0, fence.startLine, 0), {
          title: '$(sparkle) Edit visually',
          tooltip: 'Open this diagram in the Merlay visual editor',
          command: EDIT_FENCE_COMMAND,
          arguments: [document.uri.toString(), fence.startLine],
        })
    );
  }
}

interface FenceAnchor {
  hintLine: number;
  initialCode: string;
  latestCode: string;
}

interface ActiveFenceSession {
  panel: vscode.WebviewPanel;
  documentUri: string;
  startLine: number;
  anchor: FenceAnchor;
  wiring: vscode.Disposable;
}

let activeSession: ActiveFenceSession | null = null;

export function isPanelActive(): boolean {
  return activeSession !== null;
}

/**
 * Open or switch diagram in the Merlay visual editor.
 * Reuses an existing panel if open to preserve screen space and avoid column sprawl.
 */
export async function openFenceEditor(
  extensionUri: vscode.Uri,
  uriString: string | undefined,
  startLine: number | undefined
): Promise<void> {
  if (typeof uriString !== 'string' || typeof startLine !== 'number') {
    void vscode.window.showErrorMessage('Merlay: open this from a mermaid fence lens or command.');
    return;
  }
  const document = await vscode.workspace.openTextDocument(vscode.Uri.parse(uriString));
  const fences = findMermaidFences(document.getText());
  const fence = fences.find((f) => f.startLine === startLine) ?? fences[0];
  if (!fence) {
    void vscode.window.showErrorMessage('Merlay: that mermaid block moved or was deleted.');
    return;
  }

  const anchor: FenceAnchor = {
    hintLine: fence.startLine,
    initialCode: fence.code,
    latestCode: fence.code,
  };

  const title = formatFenceTitle(document.uri.path, fence.startLine, fences);

  // Helper to wire up two-way sync between document and panel
  const wirePanel = (targetPanel: vscode.WebviewPanel) =>
    attachVisualPanel(targetPanel, document, {
      readCode: () => {
        const currentFences = findMermaidFences(document.getText());
        const current =
          currentFences.find((f) => f.code.trim() === anchor.latestCode.trim()) ??
          currentFences.find((f) => f.startLine === anchor.hintLine);
        if (current) {
          anchor.hintLine = current.startLine;
          return current.code;
        }
        return anchor.latestCode;
      },
      writeCode: async (code: string) => {
        const res = replaceMermaidBlock(
          document.getText(),
          code,
          anchor.hintLine,
          anchor.initialCode,
          anchor.latestCode
        );
        anchor.hintLine = res.newStartLine;
        anchor.initialCode = code.trim();
        anchor.latestCode = code;
        const edit = new vscode.WorkspaceEdit();
        edit.replace(document.uri, fullDocRange(document), res.updatedText);
        await vscode.workspace.applyEdit(edit);
      },
    });

  // Reuse existing panel if active
  if (activeSession) {
    const { panel } = activeSession;
    panel.title = title;
    panel.reveal(panel.viewColumn ?? vscode.ViewColumn.Beside, false);

    // If switching diagram or document, rewire and update source code
    if (activeSession.documentUri !== uriString || activeSession.startLine !== fence.startLine) {
      activeSession.wiring.dispose();
      activeSession.documentUri = uriString;
      activeSession.startLine = fence.startLine;
      activeSession.anchor = anchor;
      activeSession.wiring = wirePanel(panel);
      void panel.webview.postMessage({ type: 'merlay/update', code: fence.code });
    }
    return;
  }

  // Create new panel beside the active editor
  const panel = createVisualPanel('merlay.fenceEditor', title, extensionUri);
  const wiring = wirePanel(panel);

  activeSession = {
    panel,
    documentUri: uriString,
    startLine: fence.startLine,
    anchor,
    wiring,
  };

  panel.onDidDispose(() => {
    if (activeSession?.panel === panel) {
      activeSession.wiring.dispose();
      activeSession = null;
    }
  });
}

/**
 * Edit the diagram at or nearest to the cursor in the active editor.
 * Provides fallback access when CodeLens is disabled.
 */
export async function editDiagramAtCursor(extensionUri: vscode.Uri): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    void vscode.window.showInformationMessage(
      'Merlay: open a Markdown or Mermaid file to edit diagrams.'
    );
    return;
  }

  const doc = editor.document;
  if (doc.languageId === 'mermaid') {
    await vscode.commands.executeCommand('vscode.openWith', doc.uri, MERLAY_EDITOR_VIEW_TYPE);
    return;
  }

  if (doc.languageId !== 'markdown') {
    void vscode.window.showInformationMessage(
      'Merlay: active document is not a Markdown or Mermaid file.'
    );
    return;
  }

  const fences = findMermaidFences(doc.getText());
  if (fences.length === 0) {
    void vscode.window.showInformationMessage(
      'Merlay: no Mermaid diagrams found in this Markdown document.'
    );
    return;
  }

  const cursorLine = editor.selection.active.line;
  const targetFence = findNearestFence(fences, cursorLine);

  // If inside or near (< 6 lines), open directly
  if (targetFence) {
    const isInside = cursorLine >= targetFence.startLine && cursorLine <= targetFence.endLine;
    const distance = Math.min(
      Math.abs(cursorLine - targetFence.startLine),
      Math.abs(cursorLine - targetFence.endLine)
    );
    if (isInside || distance <= 5 || fences.length === 1) {
      await openFenceEditor(extensionUri, doc.uri.toString(), targetFence.startLine);
      return;
    }
  }

  // If far from any diagram and multiple exist, prompt via QuickPick
  await selectDiagram(extensionUri);
}

/**
 * QuickPick selector to jump between Mermaid diagrams in the active document.
 */
export async function selectDiagram(extensionUri: vscode.Uri): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.languageId !== 'markdown') {
    void vscode.window.showInformationMessage(
      'Merlay: open a Markdown document containing Mermaid diagrams.'
    );
    return;
  }

  const doc = editor.document;
  const fences = findMermaidFences(doc.getText());
  if (fences.length === 0) {
    void vscode.window.showInformationMessage(
      'Merlay: no Mermaid diagrams found in this document.'
    );
    return;
  }

  if (fences.length === 1) {
    await openFenceEditor(extensionUri, doc.uri.toString(), fences[0].startLine);
    return;
  }

  interface DiagramPickItem extends vscode.QuickPickItem {
    startLine: number;
  }

  const items: DiagramPickItem[] = fences.map((f, i) => {
    const lines = f.code.trim().split('\n');
    const header = lines[0] || 'Diagram';
    const preview = lines.slice(1, 4).join('  |  ');
    return {
      label: `$(symbol-misc) Diagram ${i + 1}: ${header}`,
      description: `Lines ${f.startLine + 1}–${f.endLine + 1}`,
      detail: preview || header,
      startLine: f.startLine,
    };
  });

  const chosen = await vscode.window.showQuickPick(items, {
    placeHolder: 'Select a Mermaid diagram to edit visually',
    matchOnDescription: true,
    matchOnDetail: true,
  });

  if (chosen) {
    await openFenceEditor(extensionUri, doc.uri.toString(), chosen.startLine);
  }
}

/**
 * Handle custom URI requests (e.g. from the Markdown Preview overlay button).
 * Scheme: vscode://dev-hashemi.merlay/edit-fence?line=15
 */
export async function handleUriFenceEdit(
  extensionUri: vscode.Uri,
  targetLine?: number
): Promise<void> {
  // Find the active or most relevant markdown document
  let doc = vscode.window.activeTextEditor?.document;
  if (!doc || doc.languageId !== 'markdown') {
    const visible = vscode.window.visibleTextEditors.find(
      (e) => e.document.languageId === 'markdown'
    );
    doc = visible?.document;
  }

  if (!doc) {
    // Check all open text documents
    doc = vscode.workspace.textDocuments.find((d) => d.languageId === 'markdown');
  }

  if (!doc) {
    void vscode.window.showInformationMessage(
      'Merlay: please open the Markdown note in an editor to edit visually.'
    );
    return;
  }

  const fences = findMermaidFences(doc.getText());
  if (fences.length === 0) {
    void vscode.window.showInformationMessage('Merlay: no diagrams found in the active document.');
    return;
  }

  const targetFence =
    targetLine !== undefined ? findNearestFence(fences, targetLine) : fences[0];

  if (targetFence) {
    await openFenceEditor(extensionUri, doc.uri.toString(), targetFence.startLine);
  }
}
