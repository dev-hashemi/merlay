/**
 * DOM MutationObserver and Markdown post-processor tracking for Mermaid diagrams in Obsidian
 */

import {
  MarkdownPostProcessorContext,
  MarkdownRenderChild,
  MarkdownView,
} from 'obsidian';
import type MerlayPlugin from '../main';
import { attachEditButton } from './buttonInjector';

export class MermaidObserverChild extends MarkdownRenderChild {
  private observer: MutationObserver;

  constructor(containerEl: HTMLElement, observer: MutationObserver) {
    super(containerEl);
    this.observer = observer;
  }

  onunload(): void {
    this.observer.disconnect();
  }
}

export function setupGlobalWorkspaceObserver(plugin: MerlayPlugin): void {
  let scanTimer: number | null = null;
  const scheduleScan = (delay = 100) => {
    if (scanTimer !== null) window.clearTimeout(scanTimer);
    scanTimer = window.setTimeout(() => {
      scanTimer = null;
      scanActiveWorkspace(plugin);
    }, delay);
  };

  const target = plugin.app.workspace.containerEl || document.body;
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.addedNodes.length > 0) {
        scheduleScan(120);
        return;
      }
    }
  });

  observer.observe(target, {
    childList: true,
    subtree: true,
  });

  plugin.register(() => {
    observer.disconnect();
    if (scanTimer !== null) window.clearTimeout(scanTimer);
  });

  // Initial staggered scans to catch asynchronously rendered diagrams
  scheduleScan(50);
  scheduleScan(250);
  scheduleScan(600);
  scheduleScan(1200);

  // Also re-scan on workspace layout and leaf changes
  plugin.registerEvent(
    plugin.app.workspace.on('layout-change', () => scheduleScan(100))
  );
  plugin.registerEvent(
    plugin.app.workspace.on('active-leaf-change', () => scheduleScan(100))
  );
  plugin.registerEvent(
    plugin.app.workspace.on('editor-change', () => scheduleScan(150))
  );
}

export function scanActiveWorkspace(plugin: MerlayPlugin): void {
  const root = plugin.app.workspace.containerEl || document.body;
  scanAndAttachToElement(root, plugin);
}

export function scanActiveView(plugin: MerlayPlugin): void {
  const view = plugin.app.workspace.getActiveViewOfType(MarkdownView);
  if (!view) return;
  scanAndAttachToElement(view.contentEl, plugin, view.file?.path);
}

export function scanAndAttachToElement(
  container: HTMLElement,
  plugin: MerlayPlugin,
  sourcePath?: string,
  context?: MarkdownPostProcessorContext
): void {
  // Never scan inside our own editor modal or standalone view
  if (
    container.closest('.mod-mermaid-block-modal') ||
    container.closest('.mermaid-block-modal-root') ||
    container.closest('.mermaid-file-view-root') ||
    container.closest('.mermaid-native-container') ||
    container.closest('.mermaid-native-view') ||
    container.closest('.mermaid-native-editor-root') ||
    container.closest('.merlay-leaf-root') ||
    container.closest('.mermaid-studio-leaf-root') ||
    container.closest('.mermaid-native-world') ||
    container.closest('.mermaid-native-svg-mount')
  ) {
    return;
  }

  const mermaidSelectors = [
    '.block-language-mermaid',
    '.mermaid',
    'pre.language-mermaid',
    'svg[id*="mermaid"]',
    'svg .flowchart-link',
  ];

  const targets: HTMLElement[] = [];
  for (const sel of mermaidSelectors) {
    if (container.matches?.(sel)) {
      targets.push(container);
    }
    container.querySelectorAll(sel).forEach((el) => {
      targets.push(el as HTMLElement);
    });
  }

  const seenContainers = new Set<HTMLElement>();
  for (const el of targets) {
    const parent = findMermaidContainer(el);
    if (parent && !seenContainers.has(parent)) {
      seenContainers.add(parent);
      attachEditButton(parent, plugin, sourcePath, context);
    }
  }
}

export function findMermaidContainer(el: HTMLElement): HTMLElement | null {
  // 1. STRICT: Never attach button inside Merlay modals or editor views
  if (
    el.closest('.mod-mermaid-block-modal') ||
    el.closest('.mermaid-block-modal-root') ||
    el.closest('.mermaid-file-view-root') ||
    el.closest('.mermaid-native-container') ||
    el.closest('.mermaid-native-view') ||
    el.closest('.mermaid-native-editor-root') ||
    el.closest('.merlay-leaf-root') ||
    el.closest('.mermaid-studio-leaf-root') ||
    el.closest('.mermaid-native-world') ||
    el.closest('.mermaid-native-svg-mount')
  ) {
    return null;
  }

  // 2. In Live Preview (CodeMirror 6), find the embed container
  const cmBlock =
    el.closest('.cm-preview-code-block') || el.closest('.cm-embed-block');
  if (cmBlock) return cmBlock as HTMLElement;

  // 3. In Reading View, find .block-language-mermaid
  const blockLang = el.classList?.contains('block-language-mermaid')
    ? el
    : el.closest('.block-language-mermaid');
  if (blockLang) return blockLang as HTMLElement;

  const mermaidDiv = el.classList?.contains('mermaid')
    ? el
    : el.closest('.mermaid');
  if (mermaidDiv) return mermaidDiv as HTMLElement;

  return el.parentElement || el;
}
