import { findNodeShapeElements } from './haloUtils';

/**
 * Highlight the pending drop target while drag-connecting.
 * Adds .mermaid-drop-target to every SVG element for the target participant
 * (top box, lifeline, bottom box) and clones matching halo geometry with
 * .mermaid-drop-target-halo so the user sees what will connect.
 * When blocked is true, .mermaid-drop-blocked is used instead so the refusal
 * is visible. Pass null/undefined or the source id to clear.
 */
export function applyDropTargetHalo(
  mountEl: HTMLElement | null,
  targetId: string | null | undefined,
  sourceId?: string | null,
  blocked?: boolean
): void {
  if (!mountEl) return;

  mountEl
    .querySelectorAll('.mermaid-drop-target-halo')
    .forEach((el) => el.remove());
  mountEl.querySelectorAll('.mermaid-drop-target').forEach((el) => {
    el.classList.remove('mermaid-drop-target');
  });
  mountEl.querySelectorAll('.mermaid-drop-blocked').forEach((el) => {
    el.classList.remove('mermaid-drop-blocked');
  });

  if (!targetId || targetId === sourceId) return;

  const targetClass = blocked ? 'mermaid-drop-blocked' : 'mermaid-drop-target';
  const nodeEls = Array.from(
    mountEl.querySelectorAll(`[data-mermaid-node-id="${targetId}"]`)
  ).filter(
    (el) => !el.classList.contains('mermaid-lifeline-hit-area')
  );
  if (nodeEls.length === 0) return;

  for (const nodeEl of nodeEls) {
    nodeEl.classList.add(targetClass);

    const shapeElements = findNodeShapeElements(nodeEl);
    if (shapeElements.length === 0) continue;

    shapeElements.forEach((shapeEl) => {
      const parent = shapeEl.parentNode;
      if (!parent) return;

      const dropHalo = shapeEl.cloneNode(false) as SVGElement;
      dropHalo.removeAttribute('id');
      dropHalo.removeAttribute('style');
      dropHalo.removeAttribute('fill');
      dropHalo.removeAttribute('stroke');
      dropHalo.setAttribute('fill', 'none');
      dropHalo.setAttribute(
        'class',
        'mermaid-drop-target-halo'
      );
      dropHalo.setAttribute('pointer-events', 'none');

      parent.insertBefore(dropHalo, shapeEl.nextSibling);
    });
  }
}
