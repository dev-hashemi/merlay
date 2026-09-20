import { useRef, useCallback, useMemo } from 'react';
import { useCanvasStore } from '../store/canvasStore';
import {
  PopoverPos,
  Rect,
  SelectedEdgePos,
} from '../types';
import {
  applySelectedEdgeHalos,
  applySelectedNodeHalos,
} from '../renderer/selectionHalo';
import {
  calculateMultiSelectBounds,
  calculatePopoverPosition,
  resolveNodeBoundingRect,
} from './selection/selectionGeometry';
import { useSelectionStoreActions } from './selection/useSelectionStoreActions';

export interface UseCanvasSelectionOptions {
  svgMountRef: React.RefObject<HTMLDivElement>;
  getLocalRect: (el: Element) => Rect | null;
  displayDirection: string;
}

export function useCanvasSelection({
  svgMountRef,
  getLocalRect,
  displayDirection,
}: UseCanvasSelectionOptions) {
  const selectedNodeIds = useCanvasStore((s) => s.selectedNodeIds);
  const selectedEdgeIds = useCanvasStore((s) => s.selectedEdgeIds);
  const selectedSubgraphId = useCanvasStore((s) => s.selectedSubgraphId);
  const selectedStarKind = useCanvasStore((s) => s.selectedStarKind);

  const selectedNodeRect = useCanvasStore((s) => s.selectedNodeRect);
  const selectedEdgePos = useCanvasStore((s) => s.selectedEdgePos);
  const selectedSubgraphRect = useCanvasStore((s) => s.selectedSubgraphRect);

  const activeNodePopover = useCanvasStore((s) => s.activeNodePopover);
  const activeEdgePopover = useCanvasStore((s) => s.activeEdgePopover);
  const activeMultiPopover = useCanvasStore((s) => s.activeMultiPopover);
  const activeSubgraphPopover = useCanvasStore((s) => s.activeSubgraphPopover);

  const unmatchedSubgraphIds = useCanvasStore((s) => s.unmatchedSubgraphIds);

  const {
    setSelectedNodeIds,
    setSelectedEdgeIds,
    setSelectedSubgraphId,
    setSelectedNodeRect,
    setSelectedEdgePos,
    setSelectedSubgraphRect,
    setActiveNodePopover,
    setActiveEdgePopover,
    setActiveMultiPopover,
    setActiveSubgraphPopover,
    setUnmatchedSubgraphIds,
  } = useSelectionStoreActions();

  const selectedNodeIdsRef = useRef<Set<string>>(selectedNodeIds);
  selectedNodeIdsRef.current = selectedNodeIds;
  const selectedEdgeIdsRef = useRef<Set<string>>(selectedEdgeIds);
  selectedEdgeIdsRef.current = selectedEdgeIds;

  const isMultiSelect = selectedNodeIds.size + selectedEdgeIds.size > 1;

  const selectedNodeId =
    selectedNodeIds.size === 1 ? Array.from(selectedNodeIds)[0] : null;
  const selectedEdgeId =
    selectedEdgeIds.size === 1 ? Array.from(selectedEdgeIds)[0] : null;

  const updateSelectedNodeHalo = useCallback(
    (targets?: string | null | Set<string> | string[]) => {
      applySelectedNodeHalos(
        svgMountRef.current,
        targets ?? selectedNodeIdsRef.current,
        useCanvasStore.getState().selectedStarKind
      );
    },
    [svgMountRef]
  );

  const updateSelectedEdgeHalo = useCallback(
    (targets?: string | null | Set<string> | string[]) => {
      applySelectedEdgeHalos(
        svgMountRef.current,
        targets ?? selectedEdgeIdsRef.current
      );
    },
    [svgMountRef]
  );

  const updateSelectedNodeRect = useCallback(() => {
    const currentId =
      selectedNodeIdsRef.current.size === 1
        ? Array.from(selectedNodeIdsRef.current)[0]
        : null;
    if (!currentId || !svgMountRef.current) {
      setSelectedNodeRect(null);
      return;
    }
    const rect = resolveNodeBoundingRect(
      svgMountRef.current,
      currentId,
      selectedStarKind,
      getLocalRect
    );
    setSelectedNodeRect(rect);
  }, [getLocalRect, svgMountRef, selectedStarKind, setSelectedNodeRect]);

  const setSelectedNodeId = useCallback(
    (id: string | null) => {
      const newSet = id ? new Set([id]) : new Set<string>();
      selectedNodeIdsRef.current = newSet;
      setSelectedNodeIds(newSet);
      updateSelectedNodeHalo(newSet);
      if (id && svgMountRef.current) {
        const rect = resolveNodeBoundingRect(
          svgMountRef.current,
          id,
          selectedStarKind,
          getLocalRect
        );
        setSelectedNodeRect(rect);
      } else {
        setSelectedNodeRect(null);
      }
    },
    [getLocalRect, updateSelectedNodeHalo, svgMountRef, selectedStarKind, setSelectedNodeIds, setSelectedNodeRect]
  );

  const setSelectedEdgeId = useCallback(
    (id: string | null) => {
      const newSet = id ? new Set([id]) : new Set<string>();
      selectedEdgeIdsRef.current = newSet;
      setSelectedEdgeIds(newSet);
      updateSelectedEdgeHalo(newSet);
    },
    [updateSelectedEdgeHalo, setSelectedEdgeIds]
  );

  const clearSelection = useCallback(() => {
    const s = useCanvasStore.getState();
    s.clearSelection();
    s.clearPopovers();
    s.setSelectedNodeRect(null);
    s.setSelectedEdgePos(null);
    s.setSelectedSubgraphRect(null);
    updateSelectedNodeHalo(new Set());
    updateSelectedEdgeHalo(new Set());
  }, [updateSelectedNodeHalo, updateSelectedEdgeHalo]);

  const isLR = displayDirection === 'LR' || displayDirection === 'RL';
  const sproutX = selectedNodeRect
    ? isLR
      ? selectedNodeRect.x + selectedNodeRect.width + 12
      : selectedNodeRect.x + selectedNodeRect.width / 2
    : 0;
  const sproutY = selectedNodeRect
    ? isLR
      ? selectedNodeRect.y + selectedNodeRect.height / 2
      : selectedNodeRect.y + selectedNodeRect.height + 12
    : 0;

  // Bounding box enclosing all selected nodes & edges in world coordinates (for Multi-Select)
  const multiSelectBounds = useMemo(() => {
    if (!svgMountRef.current) return null;
    return calculateMultiSelectBounds(
      svgMountRef.current,
      selectedNodeIds,
      selectedEdgeIds,
      getLocalRect
    );
  }, [selectedNodeIds, selectedEdgeIds, getLocalRect, svgMountRef]);

  // Position for Shape, Arrow Type & Style popovers
  const popoverPos: PopoverPos | null = useMemo(() => {
    return calculatePopoverPosition({
      isMultiSelect,
      multiSelectBounds,
      selectedNodeRect,
      selectedEdgePos,
      sproutX,
      sproutY,
      isLR,
    });
  }, [
    isMultiSelect,
    multiSelectBounds,
    selectedNodeRect,
    selectedEdgePos,
    sproutX,
    sproutY,
    isLR,
  ]);

  // Position for the subgraph style popover (anchored above the group HUD)
  const subgraphPopoverPos: PopoverPos | null = useMemo(() => {
    if (!selectedSubgraphRect || !selectedSubgraphId) return null;
    return {
      left: selectedSubgraphRect.x + selectedSubgraphRect.width / 2,
      top: selectedSubgraphRect.y - 20,
      transform: 'translate(-50%, -100%)',
    };
  }, [selectedSubgraphRect, selectedSubgraphId]);

  const isolateSelection = useCallback(
    (keepType: 'node' | 'edge' | 'subgraph', id: string) => {
      const empty = new Set<string>();
      if (keepType === 'node') {
        const set = new Set([id]);
        setSelectedNodeIds(set);
        setSelectedEdgeIds(empty);
        setSelectedSubgraphId(null);
        setSelectedSubgraphRect(null);
        updateSelectedNodeHalo(set);
        updateSelectedEdgeHalo(empty);
      } else if (keepType === 'edge') {
        const set = new Set([id]);
        setSelectedNodeIds(empty);
        setSelectedEdgeIds(set);
        setSelectedSubgraphId(null);
        setSelectedSubgraphRect(null);
        updateSelectedNodeHalo(empty);
        updateSelectedEdgeHalo(set);
      } else if (keepType === 'subgraph') {
        setSelectedNodeIds(empty);
        setSelectedEdgeIds(empty);
        setSelectedSubgraphId(id);
        updateSelectedNodeHalo(empty);
        updateSelectedEdgeHalo(empty);
      }
    },
    [setSelectedNodeIds, setSelectedEdgeIds, setSelectedSubgraphId, setSelectedSubgraphRect, updateSelectedNodeHalo, updateSelectedEdgeHalo]
  );

  return {
    selectedNodeId,
    selectedEdgeId,
    selectedNodeIds,
    selectedEdgeIds,
    selectedSubgraphId,
    selectedStarKind,

    selectedNodeRect,
    selectedEdgePos,
    selectedSubgraphRect,

    activeNodePopover,
    activeEdgePopover,
    activeMultiPopover,
    activeSubgraphPopover,
    unmatchedSubgraphIds,

    isMultiSelect,
    isLR,
    sproutX,
    sproutY,
    multiSelectBounds,
    popoverPos,
    subgraphPopoverPos,

    selectedNodeIdsRef,
    selectedEdgeIdsRef,

    setSelectedNodeId,
    setSelectedEdgeId,
    setSelectedNodeIds,
    setSelectedEdgeIds,
    setSelectedSubgraphId,
    setSelectedNodeRect,
    setSelectedEdgePos,
    setSelectedSubgraphRect,

    setActiveNodePopover,
    setActiveEdgePopover,
    setActiveMultiPopover,
    setActiveSubgraphPopover,
    setUnmatchedSubgraphIds,

    updateSelectedNodeRect,
    updateSelectedNodeHalo,
    updateSelectedEdgeHalo,
    clearSelection,
    isolateSelection,
  };
}
