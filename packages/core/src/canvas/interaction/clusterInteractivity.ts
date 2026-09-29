/**
 * Subgraph Cluster Interactivity Setup for Native Mermaid SVG.
 * Matches SVG cluster groups to view-model subgraphs and attaches
 * click/double-click handlers, plus hover so clusters can act as connection
 * endpoints (drag-to-connect to/from a composite/group).
 */

import { MermaidSubgraphDef } from '../../diagrams/viewModel';
import { SvgDomAdapter } from '../../diagrams/types';
import { Rect } from '../types';
import { attachTapGestures } from './touchGestures';
import { applyStyles } from '../../platform/dom';

export interface SetupClusterInteractivityOptions {
  mountEl: HTMLElement;
  dom?: SvgDomAdapter;
  displaySubgraphs: Map<string, MermaidSubgraphDef>;
  getLocalRect: (el: Element) => Rect | null;
  onSelectSubgraph: (targetSubId: string, htmlEl: Element) => void;
  onStartEditingSubgraph: (subId: string, subEl: Element) => void;
  onHoverSubgraph?: (subId: string, rect: Rect | null) => void;
}

export function setupClusterInteractivity({
  mountEl,
  dom,
  displaySubgraphs,
  getLocalRect,
  onSelectSubgraph,
  onStartEditingSubgraph,
  onHoverSubgraph,
}: SetupClusterInteractivityOptions): void {
  const defaultClusterSelector = '.cluster, [class*="cluster"], .box, [class*="box"]';
  const clusterSelector = dom?.clusterSelector
    ? `${dom.clusterSelector}, ${defaultClusterSelector}`
    : defaultClusterSelector;
  const clusterElements: Element[] = Array.from(
    mountEl.querySelectorAll(clusterSelector)
  );

  // In Mermaid sequence diagrams, boxes are rendered as <g><rect class="rect" .../><text class="text">...</text></g>
  mountEl.querySelectorAll('rect.rect').forEach((rectEl) => {
    const parentG = rectEl.parentElement;
    if (parentG && parentG.tagName.toLowerCase() === 'g') {
      if (!clusterElements.includes(parentG)) clusterElements.push(parentG);
    } else if (!clusterElements.includes(rectEl)) {
      clusterElements.push(rectEl);
    }
  });

  // Label fragments (e.g. `g.cluster-label`) are never bind targets: binding
  // one would scope clicks/highlights to the label instead of the group.
  const candidates = clusterElements.filter((el) => {
    const cls = el.getAttribute('class') || '';
    return !cls.includes('label');
  });

  const usedSubIds = new Set<string>();
  const pendingLabelClusters: Element[] = [];

  /**
   * A real group/composite container owns its frame shape directly
   * (flowchart `.cluster > rect`, state `...-cluster > rect.inner`,
   * sequence box `g > rect.rect`). Mermaid also emits grouping wrappers
   * (`g.clusters`) that share the same `cluster` substring but only group
   * other clusters — those must never claim a binding, otherwise selecting
   * one group highlights every group inside the wrapper.
   */
  const isClusterContainer = (el: Element): boolean => {
    const cls = el.getAttribute('class') || '';
    if (!cls.includes('cluster') && !cls.includes('box')) return false;
    if (cls.includes('label')) return false;
    return Array.from(el.children).some((c) =>
      ['rect', 'circle', 'polygon', 'ellipse', 'path'].includes(
        c.tagName.toLowerCase()
      )
    );
  };

  const isGroupingWrapper = (el: Element): boolean => {
    const inner = el.querySelectorAll(
      '.cluster, .box, [class*="cluster"], [class*="box"]'
    );
    for (const other of Array.from(inner)) {
      if (other !== el && isClusterContainer(other)) return true;
    }
    return false;
  };

  const groupingWrappers = new Set<Element>();
  for (const el of candidates) {
    if (isGroupingWrapper(el)) groupingWrappers.add(el);
  }

  const bindCluster = (htmlEl: SVGGraphicsElement, targetSubId: string) => {
    htmlEl.setAttribute('data-mermaid-subgraph-id', targetSubId);
    // Clusters double as connection endpoints (e.g. transitions to/from
    // composite states, edges between flowchart subgraphs). Drivers decide
    // whether the id is connectable; the canvas just resolves the drop.
    htmlEl.setAttribute('data-mermaid-node-id', targetSubId);
    applyStyles(htmlEl, { cursor: 'pointer' });

    // For sequence frames with loop lines or control structures, add an interactive
    // background hit-area rect spanning the bounding box of the lines so clicking
    // ANYWHERE inside the frame (not just on 1px border lines) selects the frame.
    const loopLines = Array.from(htmlEl.querySelectorAll('line.loopLine, line'));
    if (loopLines.length > 0 || htmlEl.getAttribute('data-et') === 'control-structure') {
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;
      for (const line of loopLines) {
        const x1 = parseFloat(line.getAttribute('x1') || '0');
        const y1 = parseFloat(line.getAttribute('y1') || '0');
        const x2 = parseFloat(line.getAttribute('x2') || '0');
        const y2 = parseFloat(line.getAttribute('y2') || '0');
        if (!isNaN(x1) && !isNaN(y1) && !isNaN(x2) && !isNaN(y2)) {
          minX = Math.min(minX, x1, x2);
          maxX = Math.max(maxX, x1, x2);
          minY = Math.min(minY, y1, y2);
          maxY = Math.max(maxY, y1, y2);
        }
      }

      if (minX < maxX && minY < maxY) {
        htmlEl.querySelectorAll('.mermaid-frame-hit-area').forEach((r) => r.remove());
        const hitArea = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        hitArea.setAttribute('class', 'mermaid-frame-hit-area');
        hitArea.setAttribute('x', String(minX));
        hitArea.setAttribute('y', String(minY));
        hitArea.setAttribute('width', String(maxX - minX));
        hitArea.setAttribute('height', String(maxY - minY));
        hitArea.setAttribute('fill', 'transparent');
        hitArea.setAttribute('pointer-events', 'all');
        applyStyles(hitArea, { cursor: 'pointer' });
        hitArea.onclick = (e) => {
          e.stopPropagation();
          onSelectSubgraph(targetSubId, htmlEl);
        };
        hitArea.ondblclick = (e) => {
          e.stopPropagation();
          onStartEditingSubgraph(targetSubId, htmlEl);
        };
        attachTapGestures(hitArea, {
          onDoubleTap: () => onStartEditingSubgraph(targetSubId, htmlEl),
        });
        htmlEl.prepend(hitArea);
      }
    }

    // Ensure all interactive children receive clicks. Flowchart HTML labels
    // use foreignObject, not <text>, so we include it explicitly.
    htmlEl
      .querySelectorAll('rect, text, line, path, foreignObject, .cluster-label, .nodeLabel')
      .forEach((child) => {
        const childEl = child as SVGGraphicsElement;
        applyStyles(childEl, { cursor: 'pointer' });
        childEl.setAttribute('pointer-events', 'all');
        childEl.onclick = (e) => {
          e.stopPropagation();
          onSelectSubgraph(targetSubId, htmlEl);
        };
        childEl.ondblclick = (e) => {
          e.stopPropagation();
          onStartEditingSubgraph(targetSubId, htmlEl);
        };
        attachTapGestures(childEl, {
          onDoubleTap: () => onStartEditingSubgraph(targetSubId, htmlEl),
        });
      });

    htmlEl.onclick = (e) => {
      e.stopPropagation();
      onSelectSubgraph(targetSubId, htmlEl);
    };
    htmlEl.ondblclick = (e) => {
      e.stopPropagation();
      onStartEditingSubgraph(targetSubId, htmlEl);
    };
    // Touch: double-tap renames. Subgraphs are single-select only, so no long-press.
    attachTapGestures(htmlEl, {
      onDoubleTap: () => onStartEditingSubgraph(targetSubId, htmlEl),
    });
    if (onHoverSubgraph) {
      htmlEl.onmouseenter = () => {
        onHoverSubgraph(targetSubId, getLocalRect(htmlEl));
      };
    }
  };

  const matchById = (htmlEl: Element): string | null => {
    const idAttr = htmlEl.getAttribute('id') || '';
    if (idAttr) {
      const prefixes = dom?.clusterIdPrefixes || dom?.nodeIdPrefixes || ['flowchart-', 'state-'];
      for (const subId of displaySubgraphs.keys()) {
        if (usedSubIds.has(subId)) continue;
        if (
          prefixes.some(
            (p) => idAttr.includes(`${p}${subId}-`) || idAttr === `${p}${subId}`
          ) ||
          idAttr.includes(`flowchart-${subId}-`) ||
          idAttr === `flowchart-${subId}` ||
          idAttr.includes(`state-${subId}-`) ||
          idAttr === `state-${subId}` ||
          idAttr.endsWith(`-${subId}`) ||
          idAttr === subId
        ) {
          return subId;
        }
      }
    }
    return null;
  };

  const matchByContainment = (htmlEl: Element): string | null => {

    // 1. Direct DOM containment (flowchart / state subgraphs)
    for (const [subId, subDef] of displaySubgraphs.entries()) {
      if (usedSubIds.has(subId)) continue;
      if (subDef.nodeIds.length === 0) continue;
      for (const nid of subDef.nodeIds) {
        if (htmlEl.querySelector(`[data-mermaid-node-id="${nid}"]`)) {
          return subId;
        }
      }
    }

    // 2. Geometric horizontal containment (for sequence diagram boxes where participants are siblings)
    const boxRect = getLocalRect(htmlEl);
    if (boxRect) {
      for (const [subId, subDef] of displaySubgraphs.entries()) {
        if (usedSubIds.has(subId)) continue;
        if (subDef.nodeIds.length === 0) continue;
        let allMatch = true;
        for (const nid of subDef.nodeIds) {
          const nodeEl =
            mountEl.querySelector(
              `rect.actor-top[name="${nid}"], g.actor-top[name="${nid}"], [data-mermaid-node-id="${nid}"]:not(.actor-line):not(.mermaid-lifeline-hit-area)`
            ) || mountEl.querySelector(`[data-mermaid-node-id="${nid}"]`);
          if (nodeEl) {
            const nr = getLocalRect(nodeEl);
            if (nr && (nr.x < boxRect.x - 30 || nr.x + nr.width > boxRect.x + boxRect.width + 30)) {
              allMatch = false;
              break;
            }
          }
        }
        if (allMatch) {
          return subId;
        }
      }
    }

    return null;
  };

  // Pass 1: precise id matching for every candidate. Runs ahead of the
  // fuzzier passes so an early element can never steal the id of a real
  // cluster later in document order.
  const unassignedClusters: Element[] = [];
  for (const el of candidates) {
    const htmlEl = el as SVGGraphicsElement;
      applyStyles(htmlEl, { cursor: 'pointer' });
    const matched = matchById(htmlEl);
    if (matched) {
      usedSubIds.add(matched);
      bindCluster(htmlEl, matched);
    } else {
      unassignedClusters.push(htmlEl);
    }
  }

  // Pass 2: containment matching for the remainder. Grouping wrappers only
  // ever matched by id (they carry none in practice); containment matching
  // on them would bind a whole multi-group wrapper to a single group.
  const unlabeledClusters: Element[] = [];
  for (const el of unassignedClusters) {
    const htmlEl = el as SVGGraphicsElement;
    const matched = groupingWrappers.has(htmlEl)
      ? null
      : matchByContainment(htmlEl);
    if (matched) {
      usedSubIds.add(matched);
      bindCluster(htmlEl, matched);
    } else {
      unlabeledClusters.push(htmlEl);
    }
  }

  const getClusterLabelText = (el: Element): string => {
    const loopTitle = el.querySelector('.loopText, .sectionTitle')?.textContent?.trim();
    if (loopTitle) return loopTitle;

    const standard = el.querySelector('.label, text, .cluster-label')?.textContent?.trim();
    if (standard) return standard;

    return Array.from(el.querySelectorAll('text'))
      .map((t) => t.textContent?.trim())
      .filter(Boolean)
      .join(' ');
  };

  // Second pass: label matching
  const clustersByLabel = new Map<string, Element[]>();
  for (const el of unlabeledClusters) {
    const labelText = getClusterLabelText(el);
    const key = labelText;
    if (!clustersByLabel.has(key)) clustersByLabel.set(key, []);
    clustersByLabel.get(key)!.push(el);
  }
  const subsByLabel = new Map<string, string[]>();
  for (const [subId, subDef] of displaySubgraphs.entries()) {
    if (usedSubIds.has(subId)) continue;
    for (const key of [subDef.label, subId]) {
      if (!subsByLabel.has(key)) subsByLabel.set(key, []);
      subsByLabel.get(key)!.push(subId);
    }
  }
  for (const el of unlabeledClusters) {
    const htmlEl = el as SVGGraphicsElement;
    if (htmlEl.hasAttribute('data-mermaid-subgraph-id')) continue;
    // A wrapper's text is the aggregate of every group inside it — never a
    // single group's label.
    if (groupingWrappers.has(htmlEl)) {
      pendingLabelClusters.push(htmlEl);
      continue;
    }
    const labelText = getClusterLabelText(htmlEl);
    const clusterQueue = clustersByLabel.get(labelText) ?? [];
    const subQueue = subsByLabel.get(labelText) ?? [];
    if (subQueue.length === 0) {
      pendingLabelClusters.push(htmlEl);
      continue;
    }
    const idx = clusterQueue.indexOf(el);
    const targetSubId = subQueue[Math.min(idx, subQueue.length - 1)];
    if (usedSubIds.has(targetSubId)) continue;
    usedSubIds.add(targetSubId);
    const qIdx = subQueue.indexOf(targetSubId);
    if (qIdx !== -1) subQueue.splice(qIdx, 1);
    bindCluster(htmlEl, targetSubId);
  }

  // Pass 4: Fallback matching for sequence frames and other unassigned control structures
  const remainingFrameSubIds = Array.from(displaySubgraphs.keys()).filter(
    (id) => !usedSubIds.has(id) && id.startsWith('frame_')
  );

  if (remainingFrameSubIds.length > 0) {
    const frameElements = candidates.filter((el) => {
      if (el.hasAttribute('data-mermaid-subgraph-id')) return false;
      return (
        el.getAttribute('data-et') === 'control-structure' ||
        el.classList.contains('loopGroup') ||
        el.classList.contains('rect') ||
        el.tagName.toLowerCase() === 'rect'
      );
    });

    for (const htmlEl of frameElements) {
      if (remainingFrameSubIds.length === 0) break;
      if (htmlEl.hasAttribute('data-mermaid-subgraph-id')) continue;

      const labelText = getClusterLabelText(htmlEl);

      // Try matching by substring first
      let matchedIdx = remainingFrameSubIds.findIndex((sid) => {
        const sub = displaySubgraphs.get(sid);
        if (!sub) return false;
        return (
          sub.label &&
          (labelText.includes(sub.label) || sub.label.includes(labelText))
        );
      });

      if (matchedIdx === -1) {
        matchedIdx = 0;
      }

      const targetSubId = remainingFrameSubIds.splice(matchedIdx, 1)[0];
      usedSubIds.add(targetSubId);
      bindCluster(htmlEl as SVGGraphicsElement, targetSubId);
    }
  }

  for (const el of pendingLabelClusters) {
    const htmlEl = el as SVGGraphicsElement;
    if (!htmlEl.onclick) {
      applyStyles(htmlEl, { cursor: 'default' });
    }
  }
}
