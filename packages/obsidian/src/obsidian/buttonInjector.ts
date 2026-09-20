/**
 * DOM button injector for editing Mermaid blocks directly from Obsidian Reading View & Live Preview
 */

import {
  MarkdownPostProcessorContext,
  MarkdownView,
  Notice,
  setIcon,
  TFile,
  WorkspaceLeaf,
} from 'obsidian';
import type MerlayPlugin from '../main';
import { MERLAY_ICON_ID } from './icons';
import { findTargetMermaidBlock } from '@merlay/core';
import { openDiagramModal } from './diagramOpener';

/** Obsidian's Editor extended with the underlying CodeMirror 6 view (Live Preview only). */
interface EditorWithCm {
  cm?: { posAtDOM: (node: Node) => number };
}

export function attachEditButton(
  parent: HTMLElement,
  plugin: MerlayPlugin,
  sourcePath?: string,
  context?: MarkdownPostProcessorContext
): void {
  if (
    !parent ||
    parent.closest('.mod-mermaid-block-modal') ||
    parent.closest('.mermaid-block-modal-root') ||
    parent.closest('.mermaid-file-view-root') ||
    parent.closest('.mermaid-native-container') ||
    parent.closest('.mermaid-native-view')
  ) {
    return;
  }

  if (parent.querySelector(':scope > .merlay-edit-btn, :scope > .mermaid-studio-edit-btn')) return;

  if (context) {
    const info = context.getSectionInfo(parent);
    if (info) {
      parent.setAttribute('data-mermaid-line-start', String(info.lineStart));
      parent.setAttribute('data-mermaid-line-end', String(info.lineEnd));
    }
  }

  parent.setCssStyles({ position: 'relative' });

  const editBtn = createEl('button', {
    cls: 'merlay-edit-btn clickable-icon',
    attr: {
      'aria-label': 'Open in visual mode',
    },
  });
  setIcon(editBtn, MERLAY_ICON_ID);

  // Dynamic positioning: match dimensions and place cleanly to the left of Obsidian's "Edit this block"
  const adjustPosition = () => {
    const editBlockBtn = parent.querySelector(
      '.edit-block-button'
    ) as HTMLElement;

    if (editBlockBtn) {
      const parentRect = parent.getBoundingClientRect();
      const ebRect = editBlockBtn.getBoundingClientRect();

      if (ebRect.width > 0 && parentRect.width > 0) {
        // Exactly match Obsidian's button dimensions
        // Position immediately to the left with 4px gap
        const offsetRight = Math.max(
          4,
          Math.round(parentRect.right - ebRect.left + 4)
        );

        // Match exact vertical top offset
        const topDiff = Math.round(ebRect.top - parentRect.top);
        editBtn.setCssStyles({
          width: `${Math.round(ebRect.width)}px`,
          height: `${Math.round(ebRect.height)}px`,
          right: `${offsetRight}px`,
          left: 'auto',
          ...(topDiff >= 0 ? { top: `${topDiff}px` } : {}),
        });
        return;
      }
    }

    // Default fallback
    editBtn.setCssStyles({
      width: '28px',
      height: '28px',
      right: '36px',
      top: 'var(--size-2-2, 8px)',
      left: 'auto',
    });
  };

  adjustPosition();
  parent.addEventListener('mouseenter', adjustPosition);
  editBtn.addEventListener('mouseenter', adjustPosition);

  editBtn.addEventListener('click', (e) => {
    void (async () => {
    e.stopPropagation();
    e.preventDefault();

    // Resolve file path and target leaf
    let filePath = sourcePath;
    let targetLeaf: WorkspaceLeaf | null = null;
    const leaves = plugin.app.workspace.getLeavesOfType('markdown');
    for (const leaf of leaves) {
      if (
        leaf.view instanceof MarkdownView &&
        leaf.view.containerEl.contains(parent)
      ) {
        targetLeaf = leaf;
        filePath = leaf.view.file?.path;
        break;
      }
    }
    if (!filePath) {
      const activeView = plugin.app.workspace.getActiveViewOfType(MarkdownView);
      targetLeaf = activeView?.leaf || null;
      filePath = activeView?.file?.path || plugin.app.workspace.getActiveFile()?.path;
    }

    if (!filePath) {
      new Notice('Could not determine note file path.');
      return;
    }

    const file = plugin.app.vault.getAbstractFileByPath(filePath);
    if (!(file instanceof TFile)) {
      new Notice('File not found in vault.');
      return;
    }

    const content = await plugin.app.vault.read(file);

    // 1. Line number hint from CodeMirror 6 posAtDOM (Live Preview)
    let hintLine: number | undefined;
    if (targetLeaf?.view instanceof MarkdownView) {
      try {
        const editor = targetLeaf.view.editor;
        const cm = (editor as unknown as EditorWithCm).cm;
        if (cm && typeof cm.posAtDOM === 'function') {
          let pos: number | null = null;
          try {
            pos = cm.posAtDOM(parent);
          } catch {
            pos = cm.posAtDOM(editBtn);
          }
          if (pos !== null && typeof pos === 'number' && pos >= 0) {
            hintLine = editor.offsetToPos(pos).line;
          }
        }
      } catch {
        /* ignore */
      }
    }

    // 2. DOM index of this button among all mermaid buttons in the view
    let domIndex: number | undefined;
    if (targetLeaf?.view instanceof MarkdownView) {
      try {
        const viewEl = targetLeaf.view.containerEl;
        const allBtns = Array.from(
          viewEl.querySelectorAll('.merlay-edit-btn, .mermaid-studio-edit-btn')
        );
        const idx = allBtns.indexOf(editBtn);
        if (idx >= 0) domIndex = idx;
      } catch {
        /* ignore */
      }
    }

    // 3. Section line start from context or dataset attribute
    let sectionLineStart: number | undefined;
    const directInfo = context ? context.getSectionInfo(parent) : null;
    if (directInfo) {
      sectionLineStart = directInfo.lineStart;
    } else {
      const stamped =
        parent.getAttribute('data-mermaid-line-start') ||
        parent
          .closest('[data-mermaid-line-start]')
          ?.getAttribute('data-mermaid-line-start');
      if (stamped) {
        const parsed = parseInt(stamped, 10);
        if (!isNaN(parsed)) sectionLineStart = parsed;
      }
    }

    // 4. Resolve exact target block
    const blockMatch = findTargetMermaidBlock({
      content,
      hintLine,
      domIndex,
      domText: parent.textContent || '',
      sectionLineStart,
    });

    if (!blockMatch) {
      new Notice('No Mermaid diagram block found in note.');
      return;
    }

    openDiagramModal(plugin, filePath, blockMatch, content);
    })();
  });

  parent.appendChild(editBtn);
}
