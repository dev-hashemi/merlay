import { findNodeShapeElements } from './haloUtils';

/**
 * Update shape-matched SVG selection halo for all currently selected nodes.
 * Clones the exact geometric SVG elements (circle, rect, polygon, path, ellipse)
 * and injects soft pulsing and crisp accent halos into the rendered SVG DOM.
 */
export function applySelectedNodeHalos(
  mountEl: HTMLElement | null,
  selectedNodeIds: Iterable<string>,
  targets?: string | null | Set<string> | string[],
  starKind?: 'start' | 'end' | null
): void {
  if (!mountEl) return;

  // 1. Clean up any existing selection halos & selected classes
  mountEl
    .querySelectorAll('.mermaid-node-selection-halo')
    .forEach((el) => el.remove());
  mountEl.querySelectorAll('.mermaid-node-selected').forEach((el) => {
    el.classList.remove('mermaid-node-selected');
  });

  let activeIds: string[] = [];
  if (targets !== undefined) {
    if (!targets) {
      activeIds = [];
    } else if (typeof targets === 'string') {
      activeIds = [targets];
    } else {
      activeIds = Array.from(targets);
    }
  } else {
    activeIds = Array.from(selectedNodeIds);
  }

  if (activeIds.length === 0) return;

  for (const activeId of activeIds) {
    // For [*] we keep start/end distinct via data-mermaid-start-end
    let selector = `[data-mermaid-node-id="${activeId}"]`;
    if ((activeId === '[*]' || activeId.startsWith('[*]:')) && starKind) {
      selector = `[data-mermaid-node-id="${activeId}"][data-mermaid-start-end="${starKind}"]`;
    }
    const nodeEls = Array.from(mountEl.querySelectorAll(selector));
    // Fallback to any [*] element if kind-filtered query found nothing (e.g. re-render race)
    const elsToUse =
      nodeEls.length > 0
        ? nodeEls
        : Array.from(mountEl.querySelectorAll(`[data-mermaid-node-id="${activeId}"]`));
    if (elsToUse.length === 0) continue;

    for (const nodeEl of elsToUse) {
      nodeEl.classList.add('mermaid-node-selected');

      // Skip only the invisible lifeline hit-area overlay. Sequence lifelines
      // (line.actor-line), top boxes and mirrored bottom boxes (actor-bottom)
      // are all part of the participant and must highlight together.
      if (nodeEl.classList.contains('mermaid-lifeline-hit-area')) {
        continue;
      }

      // 2. Identify shape elements representing the node's geometry
      const shapeElements = findNodeShapeElements(nodeEl);
      if (shapeElements.length === 0) continue;

      // 3. For each shape element, inject an outer soft pulsing glow and an inner crisp accent contour
      shapeElements.forEach((shapeEl) => {
        const parent = shapeEl.parentNode;
        if (!parent) return;

        // Outer soft pulsing halo
        const outerHalo = shapeEl.cloneNode(false) as SVGElement;
        outerHalo.removeAttribute('id');
        outerHalo.removeAttribute('style');
        outerHalo.removeAttribute('fill');
        outerHalo.removeAttribute('stroke');
        outerHalo.setAttribute('fill', 'none');
        outerHalo.setAttribute(
          'class',
          'mermaid-node-selection-halo mermaid-node-selection-halo-glow'
        );
        outerHalo.setAttribute('pointer-events', 'none');

        // Inner crisp accent contour
        const innerHalo = shapeEl.cloneNode(false) as SVGElement;
        innerHalo.removeAttribute('id');
        innerHalo.removeAttribute('style');
        innerHalo.removeAttribute('fill');
        innerHalo.removeAttribute('stroke');
        innerHalo.setAttribute('fill', 'none');
        innerHalo.setAttribute(
          'class',
          'mermaid-node-selection-halo mermaid-node-selection-halo-accent'
        );
        innerHalo.setAttribute('pointer-events', 'none');

        parent.insertBefore(outerHalo, shapeEl.nextSibling);
        parent.insertBefore(innerHalo, outerHalo.nextSibling);
      });
    }
  }
}
