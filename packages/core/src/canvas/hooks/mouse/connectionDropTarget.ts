import { Rect } from '../../types';
import { MermaidNodeDef, MermaidEdgeDef, MermaidSubgraphDef } from '../../../diagrams/viewModel';

/**
 * Snaps to the closest node/lifeline element within maxDist radius,
 * skipping subgraphs so that inner child nodes are prioritized.
 */
export function findClosestNodeElement(
  worldEl: HTMLElement,
  worldRect: DOMRect,
  worldX: number,
  worldY: number,
  sourceId: string,
  zoom: number,
  displaySubgraphs?: Map<string, MermaidSubgraphDef>,
  maxDist = 50
): { element: Element; id: string } | null {
  let closestDist = maxDist;
  let closestEl: Element | null = null;
  let closestId: string | null = null;

  const candidates = Array.from(
    worldEl.querySelectorAll('[data-mermaid-node-id]')
  );
  for (const cand of candidates) {
    const nid = cand.getAttribute('data-mermaid-node-id');
    if (!nid || nid === sourceId) continue;
    if (displaySubgraphs?.has(nid)) continue; // skip subgraphs so inner nodes win
    const r = cand.getBoundingClientRect();
    const candX = (r.left - worldRect.left) / zoom;
    const candY = (r.top - worldRect.top) / zoom;
    const candW = r.width / zoom;
    const candH = r.height / zoom;
    const dx = Math.max(candX - worldX, 0, worldX - (candX + candW));
    const dy = Math.max(candY - worldY, 0, worldY - (candY + candH));
    const dist = Math.hypot(dx, dy);
    if (dist < closestDist) {
      closestDist = dist;
      closestEl = cand;
      closestId = nid;
    }
  }

  if (closestEl && closestId) {
    return { element: closestEl, id: closestId };
  }
  return null;
}

/**
 * Checks if start/end anchor constraints prevent a connection.
 * - Start anchors can only have outgoing transitions.
 * - End anchors can only have incoming transitions.
 * - Two anchors cannot connect directly to each other.
 */
export function isBlockedAnchorEdge(
  sourceId: string | null | undefined,
  sourceKind: 'start' | 'end' | null | undefined,
  targetId: string | null | undefined,
  targetKind: 'start' | 'end' | null | undefined,
  isAnchorId: (id: string | null | undefined) => boolean
): boolean {
  const srcIsStart = isAnchorId(sourceId) && sourceKind === 'start';
  const srcIsEnd = isAnchorId(sourceId) && sourceKind === 'end';
  const tgtIsStart = isAnchorId(targetId) && targetKind === 'start';
  const tgtIsEnd = isAnchorId(targetId) && targetKind === 'end';

  return (
    (isAnchorId(targetId) && isAnchorId(sourceId)) ||
    srcIsEnd ||
    tgtIsStart ||
    (isAnchorId(targetId) && !tgtIsEnd) ||
    (isAnchorId(sourceId) && !srcIsStart)
  );
}

/**
 * Composite nesting guard: only outer nodes can point to composite subgraphs;
 * inner nodes cannot point outward to their enclosing composite.
 */
export function isInnerToOuterBlocked(
  sourceId: string | null | undefined,
  targetId: string | null | undefined,
  displayNodes?: Map<string, MermaidNodeDef>,
  displaySubgraphs?: Map<string, MermaidSubgraphDef>
): boolean {
  if (!targetId || !sourceId || !displaySubgraphs || !displayNodes) return false;
  if (!displaySubgraphs.has(targetId)) return false;

  const isSourceInsideTarget = (srcId: string, tgtSubId: string): boolean => {
    if (srcId === tgtSubId) return true;
    const node = displayNodes.get(srcId);
    if (node?.subgraphId) {
      if (node.subgraphId === tgtSubId) return true;
      return isSourceInsideTarget(node.subgraphId, tgtSubId);
    }
    const sub = displaySubgraphs.get(srcId);
    if (sub) {
      for (const parent of displaySubgraphs.values()) {
        if (parent.subgraphIds?.includes(srcId)) {
          if (parent.id === tgtSubId) return true;
          return isSourceInsideTarget(parent.id, tgtSubId);
        }
      }
    }
    return false;
  };

  return isSourceInsideTarget(sourceId, targetId);
}

/**
 * Calculates edge insertion point for sequence diagrams by inspecting the Y position
 * of existing edges.
 */
export function resolveSequenceInsertion(
  svgMountEl: HTMLElement | null,
  displayEdges: MermaidEdgeDef[] | undefined,
  connectionY: number,
  getLocalRect?: (el: Element) => Rect | null
): { insertAfterEdgeId?: string; insertAtIndex?: number } {
  if (!svgMountEl || !getLocalRect || !displayEdges || displayEdges.length === 0) {
    return {};
  }

  const edgeYPositions: Array<{ id: string; y: number }> = [];
  for (const edge of displayEdges) {
    const edgeEl = svgMountEl.querySelector(
      `[data-mermaid-edge-id="${edge.id}"]:not(.mermaid-edge-hit-area):not(.mermaid-edge-selected-clone):not(.mermaid-edge-hovered-clone)`
    );
    if (edgeEl) {
      const r = getLocalRect(edgeEl);
      if (r) {
        edgeYPositions.push({ id: edge.id, y: r.y + r.height / 2 });
      }
    }
  }

  edgeYPositions.sort((a, b) => a.y - b.y);

  if (edgeYPositions.length === 0) {
    return {};
  }

  if (connectionY < edgeYPositions[0].y) {
    return { insertAtIndex: 0 };
  }

  for (let i = edgeYPositions.length - 1; i >= 0; i--) {
    if (edgeYPositions[i].y <= connectionY) {
      return { insertAfterEdgeId: edgeYPositions[i].id };
    }
  }

  return {};
}
