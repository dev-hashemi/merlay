import { Rect } from '../../types';
import { MermaidEdgeDef } from '../../../diagrams/viewModel';
import { DiagramDriver } from '../../../diagrams/types';
import { applySelectedNodeHalos } from '../../renderer/selectionHalo';
import { useCanvasStore } from '../../store/canvasStore';

export interface RendererSelectionHandlersOptions {
  mountEl: HTMLElement;
  driver: DiagramDriver;
  getLocalRect: (el: Element) => Rect | null;
  updateSelectedNodeHalo: (nodes?: Set<string>) => void;
  updateSelectedEdgeHalo: (edges?: Set<string>) => void;
  setEditingNodeId: (id: string | null) => void;
  isAnchorId: (id: string | null | undefined) => id is string;
}

export function createRendererSelectionHandlers({
  mountEl,
  driver,
  getLocalRect,
  updateSelectedNodeHalo,
  updateSelectedEdgeHalo,
  setEditingNodeId,
  isAnchorId,
}: RendererSelectionHandlersOptions) {
  const onSelectNode = (targetNodeId: string, isMulti: boolean, htmlEl: Element) => {
    useCanvasStore.getState().setSelectedSubgraphId(null);
    useCanvasStore.getState().setSelectedSubgraphRect(null);
    useCanvasStore.getState().setActiveSubgraphPopover(null);
    mountEl.querySelectorAll('.mermaid-cluster-selected').forEach((c) =>
      c.classList.remove('mermaid-cluster-selected')
    );

    // Track which anchor (start vs end) was clicked — they share one node
    // id but have distinct visuals.
    const starKindForTarget = isAnchorId(targetNodeId)
      ? driver.dom.getAnchorKind?.(htmlEl) ?? null
      : null;

    if (isAnchorId(targetNodeId) && starKindForTarget) {
      useCanvasStore.getState().setSelectedStarKind(starKindForTarget);
    } else if (!isAnchorId(targetNodeId)) {
      useCanvasStore.getState().setSelectedStarKind(null);
    }

    if (isMulti) {
      // Anchors are single-select only — never part of a multi-select group.
      if (isAnchorId(targetNodeId)) {
        const nextNodes = new Set([targetNodeId]);
        useCanvasStore.getState().setSelectedNodeIds(nextNodes);
        useCanvasStore.getState().setSelectedEdgeIds(new Set());
        useCanvasStore.getState().setSelectedEdgePos(null);
        updateSelectedEdgeHalo(new Set());
        const rect = getLocalRect(htmlEl);
        if (rect) useCanvasStore.getState().setSelectedNodeRect(rect);
        // Kind-filtered halo — only highlight the clicked anchor, not both
        applySelectedNodeHalos(mountEl, nextNodes, undefined, starKindForTarget);
        return;
      }
      const prev = useCanvasStore.getState().selectedNodeIds;
      // Drop any existing anchor from the multi-set before toggling.
      const next = new Set(
        Array.from(prev).filter((id) => !isAnchorId(id))
      );
      if (next.has(targetNodeId)) next.delete(targetNodeId);
      else next.add(targetNodeId);
      useCanvasStore.getState().setSelectedNodeIds(next);
      updateSelectedNodeHalo(next);
    } else {
      const nextNodes = new Set([targetNodeId]);
      const emptyEdges = new Set<string>();
      useCanvasStore.getState().setSelectedNodeIds(nextNodes);
      useCanvasStore.getState().setSelectedEdgeIds(emptyEdges);
      useCanvasStore.getState().setSelectedEdgePos(null);
      updateSelectedEdgeHalo(emptyEdges);
      const rect = getLocalRect(htmlEl);
      if (rect) useCanvasStore.getState().setSelectedNodeRect(rect);
      if (isAnchorId(targetNodeId) && starKindForTarget) {
        applySelectedNodeHalos(mountEl, nextNodes, undefined, starKindForTarget);
      } else {
        updateSelectedNodeHalo(nextNodes);
      }
    }
  };

  const onSelectEdge = (targetEdge: MermaidEdgeDef, resolvedPath: Element, isMulti: boolean) => {
    useCanvasStore.getState().setSelectedStarKind(null);
    useCanvasStore.getState().setSelectedSubgraphId(null);
    useCanvasStore.getState().setSelectedSubgraphRect(null);
    useCanvasStore.getState().setActiveSubgraphPopover(null);
    mountEl.querySelectorAll('.mermaid-cluster-selected').forEach((c) =>
      c.classList.remove('mermaid-cluster-selected')
    );

    const edgeId = targetEdge.id;
    if (isMulti) {
      const prev = useCanvasStore.getState().selectedEdgeIds;
      const next = new Set(prev);
      if (next.has(edgeId)) next.delete(edgeId);
      else next.add(edgeId);
      useCanvasStore.getState().setSelectedEdgeIds(next);
      updateSelectedEdgeHalo(next);
    } else {
      const nextEdges = new Set([edgeId]);
      const emptyNodes = new Set<string>();
      useCanvasStore.getState().setSelectedEdgeIds(nextEdges);
      useCanvasStore.getState().setSelectedNodeIds(emptyNodes);
      useCanvasStore.getState().setSelectedNodeRect(null);
      setEditingNodeId(null);
      updateSelectedNodeHalo(emptyNodes);
      updateSelectedEdgeHalo(nextEdges);

      const rect = getLocalRect(resolvedPath);
      if (rect) {
        useCanvasStore.getState().setSelectedEdgePos({
          x: rect.x + rect.width / 2,
          y: rect.y + rect.height / 2,
          label: targetEdge.label,
          from: targetEdge.from,
          to: targetEdge.to,
          arrowType: targetEdge.arrowType,
        });
      }
    }
  };

  const onSelectSubgraph = (targetSubId: string, htmlEl: Element) => {
    useCanvasStore.getState().setSelectedStarKind(null);
    useCanvasStore.getState().clearSelection();
    useCanvasStore.getState().setSelectedSubgraphId(targetSubId);
    updateSelectedNodeHalo(new Set());
    updateSelectedEdgeHalo(new Set());

    mountEl.querySelectorAll('.mermaid-cluster-selected').forEach((c) =>
      c.classList.remove('mermaid-cluster-selected')
    );
    htmlEl.classList.add('mermaid-cluster-selected');

    const rect = getLocalRect(htmlEl);
    if (rect) useCanvasStore.getState().setSelectedSubgraphRect(rect);
  };

  return {
    onSelectNode,
    onSelectEdge,
    onSelectSubgraph,
  };
}
