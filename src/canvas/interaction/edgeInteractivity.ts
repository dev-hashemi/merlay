/**
 * Edge Interactivity Setup for Native Mermaid SVG.
 * Handles edge path hit-areas, stroke hovering, and edge label click/editing.
 */

import { MermaidEdgeDef, MermaidSubgraphDef } from '../../diagrams/viewModel';
import { matchSvgEdgeToAst } from '../../utils/edgeMatching';
import { getDistanceToSvgPath } from '../../utils/edgeGeometry';
import {
  clearEdgeHoverHalos,
  EDGE_HOVERED_CLONE_CLS,
  showEdgeHoverHalo,
} from '../renderer/selectionHalo';
import { attachTapGestures, guardClickAfterLongPress } from './touchGestures';

export interface SetupEdgeInteractivityOptions {
  mountEl: HTMLElement;
  displayEdges: MermaidEdgeDef[];
  displaySubgraphs?: Map<string, MermaidSubgraphDef>;
  onSelectEdge: (targetEdge: MermaidEdgeDef, resolvedPath: Element, isMulti: boolean) => void;
  onStartEditingEdge: (edgeId: string, anchorEl: Element) => void;
}

export function setupEdgeInteractivity({
  mountEl,
  displayEdges,
  displaySubgraphs,
  onSelectEdge,
  onStartEditingEdge,
}: SetupEdgeInteractivityOptions): void {
  // Precompute which edges are internal to each subgraph cluster so edge
  // hit-areas inside a cluster still select the edge, while edges that merely
  // pass *through* a cluster defer pointer events to the cluster.
  const internalEdgeClusters = new Map<string, Set<string>>();
  if (displaySubgraphs) {
    for (const [subId, subDef] of displaySubgraphs.entries()) {
      const members = new Set(subDef.nodeIds);
      if (subDef.subgraphIds) {
        for (const sid of subDef.subgraphIds) members.add(sid);
      }
      for (const edge of displayEdges) {
        if (members.has(edge.from) && members.has(edge.to)) {
          let s = internalEdgeClusters.get(edge.id);
          if (!s) { s = new Set(); internalEdgeClusters.set(edge.id, s); }
          s.add(subId);
        }
      }
    }
  }

  /**
   * If the pointer is inside a bound cluster that the given edge is NOT
   * internal to, return that cluster element so the edge handler can defer.
   * Runs at event-time so pan/zoom shifts are reflected in client rects.
   */
  const findDeferCluster = (
    clientX: number,
    clientY: number,
    edgeId: string,
  ): Element | null => {
    const clusters = mountEl.querySelectorAll('[data-mermaid-subgraph-id]');
    for (const cluster of Array.from(clusters)) {
      const rect = cluster.querySelector(':scope > rect');
      if (!rect) continue;
      const r = rect.getBoundingClientRect();
      if (
        clientX >= r.left && clientX <= r.right &&
        clientY >= r.top && clientY <= r.bottom
      ) {
        const cid = cluster.getAttribute('data-mermaid-subgraph-id')!;
        if (!internalEdgeClusters.get(edgeId)?.has(cid)) return cluster;
      }
    }
    return null;
  };

  const findEdgeForElement = (
    el: Element,
    fallbackIdx?: number
  ): MermaidEdgeDef | null => {
    const edgeGroup = el.closest(
      '.edgePath, .edgeLabel, [class*="edgePath"], [class*="edgeLabel"]'
    );
    const id = el.getAttribute('id') || edgeGroup?.getAttribute('id');
    const className = [
      el.getAttribute('class') || '',
      edgeGroup?.getAttribute('class') || '',
    ]
      .filter(Boolean)
      .join(' ');
    const textContent = (el.textContent || edgeGroup?.textContent || '').trim();

    return matchSvgEdgeToAst(
      {
        id,
        className,
        textContent,
      },
      displayEdges,
      fallbackIdx
    );
  };

  // Remove stale hit areas
  mountEl.querySelectorAll('.mermaid-edge-hit-area').forEach((el) => el.remove());

  const rawEdgePaths = mountEl.querySelectorAll(
    '.edgePaths path, .edgePath path, path.flowchart-link, [class*="flowchart-link"], line.messageLine0, line.messageLine1, [class*="messageLine"], path.messageLine0, path.messageLine1'
  );
  const edgePaths: SVGGraphicsElement[] = [];
  rawEdgePaths.forEach((p) => {
    const el = p as SVGGraphicsElement;
    const tag = el.tagName.toLowerCase();
    if (
      (tag === 'path' && el.getAttribute('d')) ||
      (tag === 'line' && el.getAttribute('x1'))
    ) {
      if (
        !el.classList.contains('mermaid-edge-hit-area') &&
        !el.classList.contains('arrowheadPath') &&
        !edgePaths.includes(el)
      ) {
        edgePaths.push(el);
      }
    }
  });

  edgePaths.forEach((pathEl, idx) => {
    const targetEdge = findEdgeForElement(pathEl, idx);
    if (!targetEdge) return;
    const targetEdgeId = targetEdge.id;

    pathEl.setAttribute('data-mermaid-edge-id', targetEdgeId);
    pathEl.setCssStyles({ cursor: 'pointer' });

    // Create an invisible 10px stroke hit overlay
    const isLine = pathEl.tagName.toLowerCase() === 'line';
    let hitArea: SVGElement;
    if (isLine) {
      const lineEl = pathEl as SVGLineElement;
      hitArea = createSvg('line');
      hitArea.setAttribute('x1', lineEl.getAttribute('x1') || '0');
      hitArea.setAttribute('y1', lineEl.getAttribute('y1') || '0');
      hitArea.setAttribute('x2', lineEl.getAttribute('x2') || '0');
      hitArea.setAttribute('y2', lineEl.getAttribute('y2') || '0');
    } else {
      hitArea = createSvg('path');
      hitArea.setAttribute('d', pathEl.getAttribute('d') || '');
    }
    hitArea.setAttribute('class', 'mermaid-edge-hit-area');
    hitArea.setAttribute('data-mermaid-edge-id', targetEdgeId);
    hitArea.setAttribute('fill', 'none');
    hitArea.setAttribute('stroke', 'transparent');
    hitArea.setAttribute('stroke-width', '14');
    hitArea.setAttribute('stroke-linecap', 'round');
    hitArea.setCssStyles({ cursor: 'pointer', pointerEvents: 'stroke' });

    pathEl.parentNode?.insertBefore(hitArea, pathEl.nextSibling);

    const onEdgeClick = (
      e: MouseEvent,
      edgeDef: MermaidEdgeDef,
      clickedEl: Element
    ) => {
      e.stopPropagation();
      e.preventDefault();

      let resolvedEdge = edgeDef;
      let resolvedPath = pathEl;
      if (e.clientX && e.clientY && edgePaths.length > 1) {
        let closestDist = Infinity;
        for (const p of edgePaths) {
          let dist = Infinity;
          if (p.instanceOf(SVGPathElement)) {
            dist = getDistanceToSvgPath(p, e.clientX, e.clientY);
          } else if (typeof p.getBoundingClientRect === 'function') {
            const bbox = p.getBoundingClientRect();
            const dx = Math.max(bbox.left - e.clientX, 0, e.clientX - bbox.right);
            const dy = Math.max(bbox.top - e.clientY, 0, e.clientY - bbox.bottom);
            dist = Math.hypot(dx, dy);
          }
          if (dist < closestDist) {
            const edgeId = p.getAttribute('data-mermaid-edge-id');
            const found = displayEdges.find((ed) => ed.id === edgeId);
            if (found) {
              closestDist = dist;
              resolvedEdge = found;
              resolvedPath = p;
            }
          }
        }
      }

      const isMulti = e.shiftKey || e.metaKey || e.ctrlKey;
      onSelectEdge(resolvedEdge, resolvedPath, isMulti);
    };

    hitArea.onclick = (e) => {
      const dc = findDeferCluster(e.clientX, e.clientY, targetEdgeId);
      if (dc) {
        e.stopPropagation();
        e.preventDefault();
        dc.dispatchEvent(new MouseEvent('click', {
          bubbles: true, cancelable: true,
          clientX: e.clientX, clientY: e.clientY,
          shiftKey: e.shiftKey, metaKey: e.metaKey, ctrlKey: e.ctrlKey,
        }));
        return;
      }
      onEdgeClick(e, targetEdge, hitArea);
    };

    pathEl.onclick = (e) => {
      const dc = findDeferCluster(e.clientX, e.clientY, targetEdgeId);
      if (dc) {
        e.stopPropagation();
        e.preventDefault();
        dc.dispatchEvent(new MouseEvent('click', {
          bubbles: true, cancelable: true,
          clientX: e.clientX, clientY: e.clientY,
          shiftKey: e.shiftKey, metaKey: e.metaKey, ctrlKey: e.ctrlKey,
        }));
        return;
      }
      onEdgeClick(e, targetEdge, pathEl);
    };

    // Touch: double-tap edits the label; long-press multi-selects.
    const edgeTap = attachTapGestures(hitArea, {
      onDoubleTap: () => onStartEditingEdge(targetEdgeId, pathEl),
      onLongPress: () => onSelectEdge(targetEdge, pathEl, true),
    });
    guardClickAfterLongPress(hitArea, edgeTap);
    guardClickAfterLongPress(pathEl, edgeTap);

    hitArea.onmouseenter = (e) => {
      if (findDeferCluster(e.clientX, e.clientY, targetEdgeId)) return;
      showEdgeHoverHalo(mountEl, pathEl, targetEdgeId);
    };

    hitArea.onmousemove = (e) => {
      if (findDeferCluster(e.clientX, e.clientY, targetEdgeId)) {
        clearEdgeHoverHalos(mountEl, targetEdgeId);
        return;
      }
      if (!mountEl.querySelector(`.${EDGE_HOVERED_CLONE_CLS}[data-mermaid-edge-id="${targetEdgeId}"]`)) {
        clearEdgeHoverHalos(mountEl);
        showEdgeHoverHalo(mountEl, pathEl, targetEdgeId);
      }
    };

    hitArea.onmouseleave = () => {
      clearEdgeHoverHalos(mountEl, targetEdgeId);
    };

    pathEl.onmousemove = hitArea.onmousemove;
    pathEl.onmouseleave = hitArea.onmouseleave;
  });

  // Setup Edge Labels
  const edgeLabels = mountEl.querySelectorAll(
    '.edgeLabels .edgeLabel, .edgeLabel, [class*="edgeLabel"], .messageText, [class*="messageText"]'
  );
  edgeLabels.forEach((el, idx) => {
    const htmlEl = el as SVGGraphicsElement;
    const targetEdge = findEdgeForElement(htmlEl, idx);
    if (!targetEdge) return;
    const targetEdgeId = targetEdge.id;

    htmlEl.setAttribute('data-mermaid-edge-id', targetEdgeId);
    htmlEl.setCssStyles({ cursor: 'pointer' });

    htmlEl.onclick = (e) => {
      const edgeDef = displayEdges.find((ed) => ed.id === targetEdgeId) || targetEdge;
      const mouseEv = e as unknown as MouseEvent;
      mouseEv.stopPropagation();
      mouseEv.preventDefault();
      const isMulti = mouseEv.shiftKey || mouseEv.metaKey || mouseEv.ctrlKey;
      onSelectEdge(edgeDef, htmlEl, isMulti);
    };

    htmlEl.ondblclick = (e) => {
      e.stopPropagation();
      e.preventDefault();
      onStartEditingEdge(targetEdgeId, htmlEl);
    };

    // Touch: double-tap renames the label.
    attachTapGestures(htmlEl, {
      onDoubleTap: () => onStartEditingEdge(targetEdgeId, htmlEl),
    });
  });
}
