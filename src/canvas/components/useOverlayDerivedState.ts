import { useCanvasStore } from '../store/canvasStore';
import { useCanvasSelection } from '../hooks/useCanvasSelection';
import { useDiagramMutations } from '../hooks/useDiagramMutations';

export interface OverlayDerivedState {
  selectedStarKind: string | null;
  canUngroup: boolean;
  selectedNodeStyle: ReturnType<typeof useDiagramMutations>['displayNodes'] extends Map<string, infer V> ? (V extends { style?: infer S } ? S : undefined) : unknown;
  selectedEdgeStyle: ReturnType<typeof useDiagramMutations>['displayEdges'][number]['style'];
  selectedSubgraphStyle: ReturnType<typeof useDiagramMutations>['displaySubgraphs'] extends Map<string, infer V> ? (V extends { style?: infer S } ? S : undefined) : unknown;
  selectedNodeLink: string | undefined;
  nodeMemberCapabilities: ReturnType<NonNullable<ReturnType<typeof useDiagramMutations>['driver']['mutations']['getNodeMemberCapabilities']>> | undefined;
  canAddStart: boolean;
  canAddEnd: boolean;
}

export function findNodeEditElement(mount: Element | null, nodeId: string): Element | null {
  return (
    mount?.querySelector(
      `rect.actor-top[name="${nodeId}"], g.actor-top[name="${nodeId}"], [data-mermaid-node-id="${nodeId}"]:not(.actor-line):not(.mermaid-lifeline-hit-area)`
    ) || mount?.querySelector(`[data-mermaid-node-id="${nodeId}"]`) || null
  );
}

export function findSubgraphEditElement(mount: Element | null, subId: string): Element | null {
  return mount?.querySelector(`[data-mermaid-subgraph-id="${subId}"]`) || null;
}

export function useOverlayDerivedState(
  selection: ReturnType<typeof useCanvasSelection>,
  mutations: ReturnType<typeof useDiagramMutations>
) {
  const { selectedNodeId, selectedEdgeId, selectedSubgraphId } = selection;
  const driver = mutations.driver;
  const selectedStarKind = useCanvasStore((s) => s.selectedStarKind);

  const canUngroup = Array.from(selection.selectedNodeIds).some(
    (nid) => !!mutations.displayNodes.get(nid)?.subgraphId
  );

  const selectedNodeStyle = selectedNodeId
    ? mutations.displayNodes.get(selectedNodeId)?.style
    : undefined;

  const selectedEdgeStyle = selectedEdgeId
    ? mutations.displayEdges.find((e) => e.id === selectedEdgeId)?.style
    : undefined;

  const selectedSubgraphStyle = selectedSubgraphId
    ? mutations.displaySubgraphs.get(selectedSubgraphId)?.style
    : undefined;

  const selectedNodeLink =
    selectedNodeId && !selection.isMultiSelect
      ? driver.getNodeLink?.(mutations.ast, selectedNodeId)
      : undefined;

  const nodeMemberCapabilities =
    selectedNodeId &&
    driver.capabilities.supportsNodeMembers &&
    driver.mutations.getNodeMemberCapabilities
      ? driver.mutations.getNodeMemberCapabilities(mutations.ast, selectedNodeId)
      : undefined;

  const canAddStart = Boolean(
    selectedSubgraphId &&
      driver.mutations.anchors &&
      !driver.mutations.anchors.has(mutations.ast, 'start', selectedSubgraphId)
  );

  const canAddEnd = Boolean(
    selectedSubgraphId &&
      driver.mutations.anchors &&
      !driver.mutations.anchors.has(mutations.ast, 'end', selectedSubgraphId)
  );

  return {
    selectedStarKind,
    canUngroup,
    selectedNodeStyle,
    selectedEdgeStyle,
    selectedSubgraphStyle,
    selectedNodeLink,
    nodeMemberCapabilities,
    canAddStart,
    canAddEnd,
  };
}
