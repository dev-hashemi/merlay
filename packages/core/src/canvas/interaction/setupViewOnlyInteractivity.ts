/**
 * View-Only Interactivity for unsupported Mermaid diagrams.
 * Enables selecting and highlighting elements (nodes, classes, entities, tasks, commits, slices)
 * without enabling any editing tools, popovers, or AST mutations.
 */

import { useCanvasStore } from '../store/canvasStore';

export function findSelectableSvgElement(
  target: Element | null,
  mountEl: HTMLElement
): Element | null {
  if (!target || !mountEl.contains(target) || target === mountEl) return null;
  const tag = target.tagName.toLowerCase();
  if (tag === 'svg') return null;

  // 1. If clicked element is inside a label or text element, search upward from its parent
  const searchRoot =
    (target.tagName === 'text' || target.tagName === 'tspan' || !!target.closest('.label, text, tspan')) && target.parentElement
      ? target.parentElement
      : target;

  const matched = searchRoot.closest(
    '.node, [class*="node"], .cluster, .actor, [class*="actor"], .task, [class*="task"], .commit, [class*="commit"], [class*="slice"], [class*="entity"], .pieCircle, g[id]'
  );

  if (matched && mountEl.contains(matched) && matched.tagName.toLowerCase() !== 'svg') {
    return matched;
  }

  // 2. Check for labeled node containing text
  const labelParent = target.closest('.label, text');
  if (labelParent && labelParent.parentElement && mountEl.contains(labelParent.parentElement)) {
    const parent = labelParent.parentElement;
    if (parent.tagName.toLowerCase() !== 'svg') {
      return parent;
    }
  }

  // 3. Fallback to closest SVG group
  const fallbackGroup = target.closest('g');
  if (fallbackGroup && mountEl.contains(fallbackGroup) && fallbackGroup.tagName.toLowerCase() !== 'svg') {
    return fallbackGroup;
  }

  return target;
}

export function clearViewHighlights(mountEl: HTMLElement | null): void {
  if (!mountEl) return;
  mountEl.querySelectorAll('.mermaid-view-highlight').forEach((el) => {
    el.classList.remove('mermaid-view-highlight');
  });
}

export function setupViewOnlyInteractivity(options: {
  mountEl: HTMLElement;
}): () => void {
  const { mountEl } = options;

  const handleClick = (e: MouseEvent) => {
    const store = useCanvasStore.getState();
    if (store.cursorMode !== 'select') return;

    const rawTarget = e.target as Element;
    if (!rawTarget) return;

    const itemEl = findSelectableSvgElement(rawTarget, mountEl);
    if (!itemEl) {
      clearViewHighlights(mountEl);
      return;
    }

    // Stop propagation so the outer canvas background click does not immediately clear the highlight
    e.stopPropagation();

    if (e.shiftKey || e.ctrlKey || e.metaKey) {
      // Toggle highlight on the clicked item
      itemEl.classList.toggle('mermaid-view-highlight');
    } else {
      // Single selection: clear previous and highlight this item
      const isAlreadyHighlighted = itemEl.classList.contains('mermaid-view-highlight');
      clearViewHighlights(mountEl);
      if (!isAlreadyHighlighted) {
        itemEl.classList.add('mermaid-view-highlight');
      }
    }
  };

  mountEl.addEventListener('click', handleClick);

  return () => {
    mountEl.removeEventListener('click', handleClick);
    clearViewHighlights(mountEl);
  };
}
