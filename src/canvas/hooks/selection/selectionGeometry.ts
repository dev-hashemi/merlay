import { PopoverPos, Rect, SelectedEdgePos } from '../../types';

/**
 * Resolves the bounding box for a selected node or anchor, handling
 * sequence diagram actor lines, anchor circles, and multi-element nodes.
 */
export function resolveNodeBoundingRect(
  svgMountEl: HTMLElement,
  nodeId: string,
  selectedStarKind: 'start' | 'end' | null,
  getLocalRect: (el: Element) => Rect | null
): Rect | null {
  const isAnchor = nodeId === '[*]' || nodeId.startsWith('[*]:');
  const selector =
    isAnchor && selectedStarKind
      ? `[data-mermaid-node-id="${nodeId}"][data-mermaid-start-end="${selectedStarKind}"]`
      : `[data-mermaid-node-id="${nodeId}"]`;

  let nodeEls = Array.from(svgMountEl.querySelectorAll(selector));
  if (nodeEls.length === 0) {
    nodeEls = Array.from(svgMountEl.querySelectorAll(`[data-mermaid-node-id="${nodeId}"]`));
  }
  if (nodeEls.length === 0) {
    return null;
  }
  if (nodeEls.length === 1) {
    return getLocalRect(nodeEls[0]);
  }

  if (!isAnchor) {
    let topEl = nodeEls[0];
    let topY = Infinity;
    for (const el of nodeEls) {
      if (
        el.classList.contains('actor-line') ||
        el.classList.contains('mermaid-lifeline-hit-area') ||
        el.tagName.toLowerCase() === 'line'
      ) {
        continue;
      }
      const r = getLocalRect(el);
      if (r && r.y < topY) {
        topY = r.y;
        topEl = el;
      }
    }
    return getLocalRect(topEl);
  }

  // Union of all matching rects (covers both start & end anchors when no kind).
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let found = false;

  for (const el of nodeEls) {
    const r = getLocalRect(el);
    if (!r) continue;
    minX = Math.min(minX, r.x);
    minY = Math.min(minY, r.y);
    maxX = Math.max(maxX, r.x + r.width);
    maxY = Math.max(maxY, r.y + r.height);
    found = true;
  }

  return found ? { x: minX, y: minY, width: maxX - minX, height: maxY - minY } : null;
}

export interface MultiSelectBounds extends Rect {
  centerX: number;
  topY: number;
}

/**
 * Calculates the union bounding box enclosing all selected nodes & edges.
 */
export function calculateMultiSelectBounds(
  svgMountEl: HTMLElement,
  selectedNodeIds: Set<string>,
  selectedEdgeIds: Set<string>,
  getLocalRect: (el: Element) => Rect | null
): MultiSelectBounds | null {
  const totalCount = selectedNodeIds.size + selectedEdgeIds.size;
  if (totalCount <= 1) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let found = 0;

  for (const id of selectedNodeIds) {
    const els = Array.from(
      svgMountEl.querySelectorAll(`[data-mermaid-node-id="${id}"]`)
    );
    for (const el of els) {
      const rect = getLocalRect(el);
      if (rect) {
        minX = Math.min(minX, rect.x);
        minY = Math.min(minY, rect.y);
        maxX = Math.max(maxX, rect.x + rect.width);
        maxY = Math.max(maxY, rect.y + rect.height);
        found++;
      }
    }
  }

  for (const edgeId of selectedEdgeIds) {
    const el = svgMountEl.querySelector(
      `path[data-mermaid-edge-id="${edgeId}"]:not(.mermaid-edge-hit-area)`
    );
    if (el) {
      const rect = getLocalRect(el);
      if (rect) {
        minX = Math.min(minX, rect.x);
        minY = Math.min(minY, rect.y);
        maxX = Math.max(maxX, rect.x + rect.width);
        maxY = Math.max(maxY, rect.y + rect.height);
        found++;
      }
    }
  }

  if (found === 0) return null;
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
    centerX: minX + (maxX - minX) / 2,
    topY: minY,
  };
}

/**
 * Calculates popover positioning anchored to multi-select, selected node sprout, or edge.
 */
export function calculatePopoverPosition(params: {
  isMultiSelect: boolean;
  multiSelectBounds: MultiSelectBounds | null;
  selectedNodeRect: Rect | null;
  selectedEdgePos: SelectedEdgePos | null;
  sproutX: number;
  sproutY: number;
  isLR: boolean;
}): PopoverPos | null {
  const {
    isMultiSelect,
    multiSelectBounds,
    selectedNodeRect,
    selectedEdgePos,
    sproutX,
    sproutY,
    isLR,
  } = params;

  if (isMultiSelect && multiSelectBounds) {
    return {
      left: multiSelectBounds.centerX,
      top: multiSelectBounds.topY - 8,
      transform: 'translate(-50%, 0)',
    };
  }
  if (selectedNodeRect) {
    return {
      left: sproutX,
      top: isLR ? sproutY + 28 : sproutY + 36,
      transform: isLR ? 'translate(0, 0)' : 'translate(-50%, 0)',
    };
  }
  if (selectedEdgePos) {
    return {
      left: selectedEdgePos.x,
      top: selectedEdgePos.y + 14,
      transform: 'translate(-50%, 0)',
    };
  }
  return null;
}
