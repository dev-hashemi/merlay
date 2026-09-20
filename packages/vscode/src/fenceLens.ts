/**
 * Markdown ```mermaid fence integration: a CodeLens above every fence opens
 * a visual panel bound to that block. Write-back reuses core's
 * `replaceMermaidBlock` (fence-aware, auto-healing) with a moving anchor,
 * mirroring the Obsidian block modal's save chain.
 */

import * as vscode from 'vscode';
import { replaceMermaidBlock } from '@merlay/core';
import { findMermaidFences } from './fences';
import { attachVisualPanel, createVisualPanel, fullDocRange } from './panels';

export const EDIT_FENCE_COMMAND = 'merlay.editMermaidFence';

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

export async function openFenceEditor(
  extensionUri: vscode.Uri,
  uriString: string | undefined,
  startLine: number | undefined
): Promise<void> {
  if (typeof uriString !== 'string' || typeof startLine !== 'number') {
    void vscode.window.showErrorMessage('Merlay: open this from a mermaid fence lens.');
    return;
  }
  const document = await vscode.workspace.openTextDocument(vscode.Uri.parse(uriString));
  const fence = findMermaidFences(document.getText()).find((f) => f.startLine === startLine);
  if (!fence) {
    void vscode.window.showErrorMessage('Merlay: that mermaid block moved or was deleted.');
    return;
  }
  const anchor: FenceAnchor = {
    hintLine: fence.startLine,
    initialCode: fence.code,
    latestCode: fence.code,
  };
  const panel = createVisualPanel(
    'merlay.fenceEditor',
    `Merlay: fence L${fence.startLine + 1}`,
    extensionUri
  );
  const wiring = attachVisualPanel(panel, document, {
    readCode: () => {
      const fences = findMermaidFences(document.getText());
      const current =
        fences.find((f) => f.code.trim() === anchor.latestCode.trim()) ??
        fences.find((f) => f.startLine === anchor.hintLine);
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
  panel.onDidDispose(() => wiring.dispose());
}
