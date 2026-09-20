/**
 * Edge halo clones for selection and hover.
 *
 * Edge strokes cannot be recolored with plain CSS classes: Mermaid scopes its
 * theme under `#<render-id>` (e.g. `#vmm_1 .edgePaths .path`, specificity
 * 1,2,0 — unbeatable by any class-only selector) and `linkStyle` emits inline
 * `style="stroke:..."` (inline beats every non-!important rule). Instead of
 * `!important`, selected/hovered edges get a geometry clone drawn directly on
 * top — the same pattern as node halos. The clone keeps the original's
 * classes (dash patterns, markers) but drops `id`/`style`/`stroke`/`fill`, so
 * only our `#merlay-svg-mount`-scoped clone rules apply to it. An inline
 * `stroke-width` (via Obsidian's `setCssStyles`, no `!important`) widens the
 * clone over custom-thick edges. Pixel output matches the old recolor exactly.
 */
export const EDGE_SELECTED_CLONE_CLS = 'mermaid-edge-selected-clone';
export const EDGE_HOVERED_CLONE_CLS = 'mermaid-edge-hovered-clone';

export const EDGE_SELECTED_HALO_WIDTH = 3.5;
export const EDGE_HOVERED_HALO_WIDTH = 2;

/** Read-only parse of an edge's effective stroke width (attribute or inline style). No style writes. */
function parseEdgeStrokeWidth(el: Element): number | null {
  const attr = el.getAttribute('stroke-width');
  if (attr) {
    const v = parseFloat(attr);
    if (!isNaN(v) && v > 0) return v;
  }
  const inline = el.getAttribute('style') || '';
  const m = inline.match(/stroke-width\s*:\s*([\d.]+)/i);
  if (m) {
    const v = parseFloat(m[1]);
    if (!isNaN(v) && v > 0) return v;
  }
  return null;
}

function cloneEdgeForHalo(
  mountEl: HTMLElement,
  original: Element,
  edgeId: string,
  cloneCls: string,
  baseWidth: number
): void {
  if (mountEl.querySelector(`.${cloneCls}[data-mermaid-edge-id="${edgeId}"]`)) {
    return;
  }
  const clone = original.cloneNode(false) as SVGElement;
  clone.removeAttribute('id');
  clone.removeAttribute('style');
  clone.removeAttribute('fill');
  clone.removeAttribute('stroke');
  clone.removeAttribute('marker-start');
  clone.removeAttribute('marker-end');
  clone.removeAttribute('marker-mid');
  clone.setAttribute('fill', 'none');
  clone.setAttribute('class', `${original.getAttribute('class') || ''} ${cloneCls}`.trim());
  clone.setAttribute('data-mermaid-edge-id', edgeId);
  clone.setAttribute('pointer-events', 'none');
  const origWidth = parseEdgeStrokeWidth(original) ?? 0;
  clone.setCssStyles({ strokeWidth: `${Math.max(baseWidth, origWidth)}px` });
  original.parentNode?.insertBefore(clone, original.nextSibling);
}

function removeEdgeClones(mountEl: HTMLElement, cloneCls: string, edgeId?: string): void {
  const selector = edgeId
    ? `.${cloneCls}[data-mermaid-edge-id="${edgeId}"]`
    : `.${cloneCls}`;
  mountEl.querySelectorAll(selector).forEach((el) => el.remove());
}

/**
 * Update selection styling for all currently selected edges.
 * Edge labels get `.mermaid-edge-selected` (their `filter` faces no
 * competing rule); edge paths/lines get accent halo clones (see above).
 */
export function applySelectedEdgeHalos(
  mountEl: HTMLElement | null,
  selectedEdgeIds: Iterable<string>,
  targets?: string | null | Set<string> | string[]
): void {
  if (!mountEl) return;

  mountEl.querySelectorAll('.mermaid-edge-selected').forEach((el) => {
    el.classList.remove('mermaid-edge-selected');
  });
  mountEl
    .querySelectorAll(`.${EDGE_SELECTED_CLONE_CLS}`)
    .forEach((el) => el.remove());

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
    activeIds = Array.from(selectedEdgeIds);
  }

  if (activeIds.length === 0) return;

  for (const activeId of activeIds) {
    // Selection wins over hover for the same edge.
    removeEdgeClones(mountEl, EDGE_HOVERED_CLONE_CLS, activeId);
    const els = mountEl.querySelectorAll(`[data-mermaid-edge-id="${activeId}"]`);
    els.forEach((el) => {
      if (el.classList.contains('mermaid-edge-hit-area')) return;
      const tag = el.tagName.toLowerCase();
      if (tag === 'path' || tag === 'line') {
        cloneEdgeForHalo(mountEl, el, activeId, EDGE_SELECTED_CLONE_CLS, EDGE_SELECTED_HALO_WIDTH);
      } else {
        el.classList.add('mermaid-edge-selected');
      }
    });
  }
}

/** Show the hover halo clone for an edge path/line. Skipped when the edge is selected (selection wins). */
export function showEdgeHoverHalo(
  mountEl: HTMLElement | null,
  pathEl: Element,
  edgeId: string
): void {
  if (!mountEl) return;
  if (mountEl.querySelector(`.${EDGE_SELECTED_CLONE_CLS}[data-mermaid-edge-id="${edgeId}"]`)) {
    return;
  }
  cloneEdgeForHalo(mountEl, pathEl, edgeId, EDGE_HOVERED_CLONE_CLS, EDGE_HOVERED_HALO_WIDTH);
}

/** Remove hover halo clones (all, or only those for one edge). */
export function clearEdgeHoverHalos(mountEl: HTMLElement | null, edgeId?: string): void {
  if (!mountEl) return;
  removeEdgeClones(mountEl, EDGE_HOVERED_CLONE_CLS, edgeId);
}
