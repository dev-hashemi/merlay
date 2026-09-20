/**
 * Node Interactivity Setup for Native Mermaid SVG.
 * Handles hit-testing, clicking, double-clicking, and hover proximity detection
 * for nodes and start/end anchors, using the driver's SVG DOM adapter.
 */

import { MermaidNodeDef, MermaidSubgraphDef } from '../../diagrams/viewModel';
import { SvgDomAdapter } from '../../diagrams/types';
import { Rect } from '../types';
import { attachTapGestures, guardClickAfterLongPress } from './touchGestures';
import { matchNodeElementId } from './matchNodeElement';
import { setupLifelineHitArea } from './lifelineInteractivity';

export type StartEndKind = 'start' | 'end' | null;

export interface SetupNodeInteractivityOptions {
  mountEl: HTMLElement;
  dom: SvgDomAdapter;
  displayNodes: Map<string, MermaidNodeDef>;
  displaySubgraphs: Map<string, MermaidSubgraphDef>;
  getLocalRect: (el: Element) => Rect | null;
  getLocalPoint?: (clientX: number, clientY: number) => { x: number; y: number } | null;
  onSelectNode: (targetNodeId: string, isMulti: boolean, htmlEl: Element) => void;
  onSelectSubgraph: (targetSubId: string, htmlEl: Element) => void;
  onStartEditingNode: (nodeId: string, nodeEl: Element, event?: MouseEvent | TouchEvent) => void;
  onStartEditingSubgraph: (subId: string, subEl: Element) => void;
  onHoverNode: (nodeId: string, rect: Rect | null, startEndKind?: StartEndKind) => void;
}

export function setupNodeInteractivity({
  mountEl,
  dom,
  displayNodes,
  displaySubgraphs,
  getLocalRect,
  getLocalPoint,
  onSelectNode,
  onSelectSubgraph,
  onStartEditingNode,
  onStartEditingSubgraph,
  onHoverNode,
}: SetupNodeInteractivityOptions): void {
  const prefixes = dom.nodeIdPrefixes || ['node-', 'flowchart-'];
  const anchorNodeId = dom.anchorNodeId;

  // Remove stale lifeline hit areas from previous render
  mountEl.querySelectorAll('.mermaid-lifeline-hit-area').forEach((el) => el.remove());

  const nodeSelector = dom.nodeSelector || '.node, [class*="node "]';
  const nodeElements = mountEl.querySelectorAll(nodeSelector);
  nodeElements.forEach((el) => {
    const htmlEl = el as SVGGraphicsElement;
    htmlEl.setCssStyles({ cursor: 'pointer' });

    const idAttr = htmlEl.getAttribute('id') || '';
    let matchedNodeId = matchNodeElementId(htmlEl, dom, displayNodes, prefixes);

    // Empty subgraphs degrade to plain `.node` elements with id `{diagramId}-{subId}`
    if (!matchedNodeId && idAttr && !prefixes.some((p) => idAttr.includes(p))) {
      for (const subId of displaySubgraphs.keys()) {
        if (idAttr === subId || idAttr.endsWith(`-${subId}`) || prefixes.some((p) => idAttr.includes(`${p}${subId}-`))) {
          htmlEl.setAttribute('data-mermaid-subgraph-id', subId);
          const targetSubId = subId;
          htmlEl.onclick = (e) => {
            e.stopPropagation();
            onSelectSubgraph(targetSubId, htmlEl);
          };
          htmlEl.ondblclick = (e) => {
            e.stopPropagation();
            onStartEditingSubgraph(targetSubId, htmlEl);
          };
          // Touch: double-tap renames (no hover/keyboard on mobile).
          attachTapGestures(htmlEl, {
            onDoubleTap: () => onStartEditingSubgraph(targetSubId, htmlEl),
          });
          return;
        }
      }
    }

    if (!matchedNodeId) return;
    const targetNodeId = matchedNodeId;
    htmlEl.setAttribute('data-mermaid-node-id', targetNodeId);
    if (anchorNodeId && targetNodeId === anchorNodeId) {
      const k = dom.getAnchorKind?.(htmlEl) ?? null;
      if (k) htmlEl.setAttribute('data-mermaid-start-end', k);
    }

    // Bottom mirrored actors in sequence diagrams should only allow click selection, no hover handles
    if (htmlEl.classList.contains('actor-bottom') || htmlEl.closest('.actor-bottom')) {
      htmlEl.onclick = (e) => {
        // Edit mode owns clicks: a linked node (<a> wrapper from mermaid's
        // click/link statements) must select, never navigate away.
        e.preventDefault();
        e.stopPropagation();
        const isMulti = e.shiftKey || e.metaKey || e.ctrlKey;
        onSelectNode(targetNodeId, isMulti, htmlEl);
      };
      return;
    }

    const isLifeline =
      (htmlEl.classList.contains('actor-line') || htmlEl.getAttribute('id')?.startsWith('actor')) &&
      htmlEl.tagName.toLowerCase() === 'line';

    const isText = htmlEl.tagName.toLowerCase() === 'text' || !!htmlEl.closest('text');
    const isActor = htmlEl.classList.contains('actor') || htmlEl.classList.contains('actor-top');

    const getPrimaryHeaderEl = (): Element | null => {
      return (
        mountEl.querySelector(
          `rect.actor-top[name="${targetNodeId}"], g.actor-top[name="${targetNodeId}"], rect.actor[name="${targetNodeId}"], [data-mermaid-node-id="${targetNodeId}"]:not(.actor-line):not(.mermaid-lifeline-hit-area):not(text):not(line)`
        ) || null
      );
    };

    htmlEl.onclick = (e) => {
      // Edit mode owns clicks: a linked node (<a> wrapper from mermaid's
      // click/link statements) must select, never navigate away. The link
      // stays reachable via the HUD "Open link" action (driver.getNodeLink).
      e.preventDefault();
      e.stopPropagation();
      const isMulti = e.shiftKey || e.metaKey || e.ctrlKey;
      onSelectNode(targetNodeId, isMulti, htmlEl);
    };

    htmlEl.ondblclick = (e) => {
      e.stopPropagation();
      onStartEditingNode(targetNodeId, htmlEl, e);
    };

    // Touch: single-tap selects via click; double-tap renames; long-press
    // multi-selects (mirrors Shift+click). Mouse pointers are ignored.
    const nodeTap = attachTapGestures(htmlEl, {
      onDoubleTap: () => onStartEditingNode(targetNodeId, htmlEl),
      onLongPress: () => onSelectNode(targetNodeId, true, htmlEl),
    });
    guardClickAfterLongPress(htmlEl, nodeTap);

    if (!isLifeline) {
      const handleHeaderHover = () => {
        let targetEl: Element = htmlEl;
        if (isText || isActor) {
          const topHeader = getPrimaryHeaderEl();
          if (topHeader) targetEl = topHeader;
        }
        const rect = getLocalRect(targetEl);
        const anchorKind =
          anchorNodeId && targetNodeId === anchorNodeId
            ? dom.getAnchorKind?.(htmlEl) ?? null
            : null;
        onHoverNode(targetNodeId, rect, anchorKind);
      };

      htmlEl.onmouseenter = handleHeaderHover;
      if (isText) {
        htmlEl.onmousemove = handleHeaderHover;
      }
    }

    // For vertical lifelines, attach an invisible 28px hit area overlay to make selection
    // and drag-to-connect dropping completely effortless anywhere along the column timeline.
    if (isLifeline) {
      setupLifelineHitArea({
        htmlEl,
        targetNodeId,
        getLocalRect,
        getLocalPoint,
        onSelectNode,
        onStartEditingNode,
        onHoverNode,
      });
    }
  });

  // Anchor shapes (e.g. mermaid renders [*] as <g class="node default"
  // id="...-root_start-…"> / outer-path end markers) are tagged separately for
  // selection and drag-to-connect.
  if (dom.anchorSelectors && anchorNodeId) {
    mountEl.querySelectorAll(dom.anchorSelectors).forEach((shapeEl) => {
      const el = shapeEl;
      const kind = dom.getAnchorKind?.(el) ?? null;
      if (!kind) return;
      const compId = dom.getAnchorCompositeId?.(el) ?? null;
      const targetAnchorId = compId ? `${anchorNodeId}:${compId}` : anchorNodeId;
      const rawContainer = el.closest('g.node, g');
      const container =
        (rawContainer as SVGGraphicsElement | null) ||
        (el as SVGGraphicsElement);
      container.setAttribute('data-mermaid-node-id', targetAnchorId);
      container.setAttribute('data-mermaid-start-end', kind);
      if (compId) {
        container.setAttribute('data-mermaid-subgraph-id', compId);
      }
      container.setCssStyles({ cursor: 'pointer' });

      container.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const isMulti =
          (e as MouseEvent).shiftKey || (e as MouseEvent).metaKey || (e as MouseEvent).ctrlKey;
        onSelectNode(targetAnchorId, isMulti, container);
      };

      container.ondblclick = (e) => {
        e.stopPropagation();
        onStartEditingNode(targetAnchorId, container);
      };
      // Touch: double-tap renames. Anchors are single-select only, so no long-press.
      attachTapGestures(container, {
        onDoubleTap: () => onStartEditingNode(targetAnchorId, container),
      });

      container.onmouseenter = () => {
        const rect = getLocalRect(container);
        onHoverNode(targetAnchorId, rect, kind);
      };
    });
  }
}
