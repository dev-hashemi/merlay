/**
 * Markdown ```mermaid fence integration: a CodeLens above every fence opens
 * a visual panel bound to that block. Write-back reuses core's
 * `replaceMermaidBlock` with a document snapshot and moving anchor,
 * mirroring the Obsidian block modal's save chain.
 *
 * Implements single-panel reuse per workspace, multi-diagram navigation,
 * context-menu / cursor command fallback, and URI handler dispatch for
 * the Markdown preview overlay.
 */

import * as vscode from 'vscode';
import { findMermaidBlockBounds, replaceMermaidBlock } from '@merlay/core';
import {
  findMermaidFences,
  findNearestFence,
  formatFenceTitle,
  resolveTargetFence,
  type MermaidFence,
} from './fences';
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
  latestCode: string;
  documentText: string;
}

interface ActiveFenceSession {
  panel: vscode.WebviewPanel;
  documentUri: string;
  startLine: number;
  anchor: FenceAnchor;
  wiring: ReturnType<typeof attachVisualPanel>;
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
  startLine: number | undefined,
  options?: { onlyIfOpen: boolean },
): Promise<void> {
  if (typeof uriString !== 'string' || typeof startLine !== 'number') {
    void vscode.window.showErrorMessage('Merlay: open this from a mermaid fence lens or command.');
    return;
  }
  const session = activeSession;
  if (options?.onlyIfOpen && !session) return;
  const document = await vscode.workspace.openTextDocument(vscode.Uri.parse(uriString));
  // A cursor update belongs to the panel that was open when it started.
  if (options?.onlyIfOpen && activeSession !== session) return;
  const fences = findMermaidFences(document.getText());
  const fence = fences.find((f) => f.startLine === startLine);
  if (!fence) {
    void vscode.window.showErrorMessage('Merlay: that mermaid block moved or was deleted.');
    return;
  }

  const anchor: FenceAnchor = {
    hintLine: fence.startLine,
    latestCode: fence.code,
    documentText: document.getText(),
  };

  const title = formatFenceTitle(document.uri.path, fence.startLine, fences);

  // Helper to wire up two-way sync between document and panel
  const wirePanel = (targetPanel: vscode.WebviewPanel) =>
    attachVisualPanel(targetPanel, document, {
      readCode: () => {
        const text = document.getText();
        const lines = text.split('\n');
        const bounds = findMermaidBlockBounds(lines, anchor.hintLine, undefined, undefined, anchor.documentText);
        if (!bounds) return anchor.latestCode;
        anchor.hintLine = bounds.start;
        anchor.latestCode = lines.slice(bounds.start + 1, bounds.end).join('\n');
        anchor.documentText = text;
        return anchor.latestCode;
      },
      writeCode: async (code: string) => {
        const res = replaceMermaidBlock(
          document.getText(),
          code,
          anchor.hintLine,
          anchor.latestCode,
          undefined,
          anchor.documentText
        );
        const edit = new vscode.WorkspaceEdit();
        edit.replace(document.uri, fullDocRange(document), res.updatedText);
        if (!(await vscode.workspace.applyEdit(edit))) throw new Error('The document could not be updated.');
        anchor.hintLine = res.newStartLine;
        anchor.latestCode = code;
        anchor.documentText = res.updatedText;
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
      activeSession.wiring.publishSource();
    }
    return;
  }

  // Open in the active editor column: a full-width tab, not a narrow split.
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
  let doc = vscode.window.activeTextEditor?.document;
  let cursorLine = vscode.window.activeTextEditor?.selection.active.line;

  if (!doc) {
    const visible = vscode.window.visibleTextEditors.find(
      (e) => e.document.languageId === 'markdown' || e.document.languageId === 'mermaid'
    );
    doc = visible?.document;
    cursorLine = visible?.selection.active.line;
  }

  if (!doc) {
    doc = vscode.workspace.textDocuments.find(
      (d) => d.languageId === 'markdown' || d.languageId === 'mermaid'
    );
  }

  if (!doc) {
    void vscode.window.showInformationMessage(
      'Merlay: open a Markdown or Mermaid file to edit diagrams.'
    );
    return;
  }

  if (doc.languageId === 'mermaid') {
    await vscode.commands.executeCommand('vscode.openWith', doc.uri, MERLAY_EDITOR_VIEW_TYPE);
    return;
  }

  const fences = findMermaidFences(doc.getText());
  if (fences.length === 0) {
    void vscode.window.showInformationMessage(
      'Merlay: no Mermaid diagrams found in this Markdown document.'
    );
    return;
  }

  if (cursorLine !== undefined) {
    const targetFence = findNearestFence(fences, cursorLine);
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
  }

  if (fences.length === 1) {
    await openFenceEditor(extensionUri, doc.uri.toString(), fences[0].startLine);
    return;
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

/** Parse a document URI from the preview, or a plain path as a fallback. */
function toDocumentUri(target: string): vscode.Uri {
  // A Windows drive path (`C:\...`) also matches the scheme pattern, so keep
  // those as file paths instead of treating `C:` as a URI scheme.
  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(target) && !/^[a-z]:[\\/]/i.test(target);
  return hasScheme ? vscode.Uri.parse(target) : vscode.Uri.file(target);
}

/**
 * Handle custom URI requests (e.g. from the Markdown Preview overlay button).
 * Scheme: vscode://dev-hashemi.merlay/edit-fence?line=15&index=0&file=...
 */
export async function handleUriFenceEdit(
  extensionUri: vscode.Uri,
  targetLine?: number,
  targetFile?: string,
  diagramIndex?: number
): Promise<void> {
  // Find the active or most relevant markdown document
  let doc: vscode.TextDocument | undefined;

  if (targetFile) {
    const targetUri = toDocumentUri(targetFile);
    doc = vscode.workspace.textDocuments.find(
      (d) => d.uri.toString() === targetUri.toString() || d.uri.fsPath === targetUri.fsPath
    );
    if (!doc) {
      try {
        doc = await vscode.workspace.openTextDocument(targetUri);
      } catch {
        // Fallback to active/visible docs
      }
    }
  }

  if (!doc) {
    const active = vscode.window.activeTextEditor?.document;
    if (active && (active.languageId === 'markdown' || active.languageId === 'mermaid')) {
      doc = active;
    }
  }

  if (!doc) {
    const visible = vscode.window.visibleTextEditors.find(
      (e) => e.document.languageId === 'markdown' || e.document.languageId === 'mermaid'
    );
    doc = visible?.document;
  }

  if (!doc) {
    // Check all open text documents
    doc = vscode.workspace.textDocuments.find(
      (d) => d.languageId === 'markdown' || d.languageId === 'mermaid'
    );
  }

  if (!doc) {
    void vscode.window.showInformationMessage(
      'Merlay: please open the Markdown note in an editor to edit visually.'
    );
    return;
  }

  if (doc.languageId === 'mermaid') {
    await vscode.commands.executeCommand('vscode.openWith', doc.uri, MERLAY_EDITOR_VIEW_TYPE);
    return;
  }

  const fences = findMermaidFences(doc.getText());
  if (fences.length === 0) {
    void vscode.window.showInformationMessage('Merlay: no diagrams found in the active document.');
    return;
  }

  const targetFence = resolveTargetFence(fences, targetLine, diagramIndex);

  if (targetFence) {
    await openFenceEditor(extensionUri, doc.uri.toString(), targetFence.startLine);
  }
}
