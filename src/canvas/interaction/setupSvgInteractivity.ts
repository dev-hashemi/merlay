/**
 * Orchestrates SVG interactivity setup for Native Mermaid diagrams:
 * binds nodes, edge hit-areas/labels, and subgraph clusters via the driver's
 * SVG DOM adapter.
 */

import { MermaidEdgeDef, MermaidNodeDef, MermaidSubgraphDef } from '../../diagrams/viewModel';
import { SvgDomAdapter } from '../../diagrams/types';
import { Rect } from '../types';
import { setupNodeInteractivity, StartEndKind } from './nodeInteractivity';
import { setupEdgeInteractivity } from './edgeInteractivity';
import { setupClusterInteractivity } from './clusterInteractivity';

export type { StartEndKind };

export interface SetupSvgInteractivityOptions {
  mountEl: HTMLElement;
  dom: SvgDomAdapter;
  displayNodes: Map<string, MermaidNodeDef>;
  displayEdges: MermaidEdgeDef[];
  displaySubgraphs: Map<string, MermaidSubgraphDef>;
  getLocalRect: (el: Element) => Rect | null;
  getLocalPoint?: (clientX: number, clientY: number) => { x: number; y: number } | null;
  onSelectNode: (targetNodeId: string, isMulti: boolean, htmlEl: Element) => void;
  onSelectEdge: (targetEdge: MermaidEdgeDef, resolvedPath: Element, isMulti: boolean) => void;
  onSelectSubgraph: (targetSubId: string, htmlEl: Element) => void;
  onStartEditingNode: (nodeId: string, nodeEl: Element) => void;
  onStartEditingEdge: (edgeId: string, anchorEl: Element) => void;
  onStartEditingSubgraph: (subId: string, subEl: Element) => void;
  onHoverNode: (nodeId: string, rect: Rect | null, startEndKind?: StartEndKind) => void;
}

export function setupSvgInteractivity(options: SetupSvgInteractivityOptions): void {
  const {
    mountEl,
    dom,
    displayNodes,
    displayEdges,
    displaySubgraphs,
    getLocalRect,
    getLocalPoint,
    onSelectNode,
    onSelectEdge,
    onSelectSubgraph,
    onStartEditingNode,
    onStartEditingEdge,
    onStartEditingSubgraph,
    onHoverNode,
  } = options;

  // 1. Nodes & start/end anchors
  setupNodeInteractivity({
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
  });

  // 2. Edges & edge labels
  setupEdgeInteractivity({
    mountEl,
    displayEdges,
    displaySubgraphs,
    onSelectEdge,
    onStartEditingEdge,
  });

  // 3. Subgraph clusters (also connectable as endpoints via data-mermaid-node-id)
  setupClusterInteractivity({
    mountEl,
    displaySubgraphs,
    getLocalRect,
    onSelectSubgraph,
    onStartEditingSubgraph,
    onHoverSubgraph: onHoverNode,
  });
}
