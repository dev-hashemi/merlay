import { useCallback } from 'react';
import { useCanvasStore } from '../../store/canvasStore';
import {
  ActiveEdgePopover,
  ActiveMultiPopover,
  ActiveNodePopover,
  Rect,
  SelectedEdgePos,
} from '../../types';

export function useSelectionStoreActions() {
  const setSelectedNodeIds = useCallback((ids: Set<string>) => {
    useCanvasStore.getState().setSelectedNodeIds(ids);
  }, []);
  const setSelectedEdgeIds = useCallback((ids: Set<string>) => {
    useCanvasStore.getState().setSelectedEdgeIds(ids);
  }, []);
  const setSelectedSubgraphId = useCallback((id: string | null) => {
    useCanvasStore.getState().setSelectedSubgraphId(id);
  }, []);
  const setSelectedNodeRect = useCallback((rect: Rect | null) => {
    useCanvasStore.getState().setSelectedNodeRect(rect);
  }, []);
  const setSelectedEdgePos = useCallback((pos: SelectedEdgePos | null) => {
    useCanvasStore.getState().setSelectedEdgePos(pos);
  }, []);
  const setSelectedSubgraphRect = useCallback((rect: Rect | null) => {
    useCanvasStore.getState().setSelectedSubgraphRect(rect);
  }, []);

  const setActiveNodePopover = useCallback(
    (val: ActiveNodePopover | ((prev: ActiveNodePopover) => ActiveNodePopover)) => {
      useCanvasStore.getState().setActiveNodePopover(val);
    },
    []
  );
  const setActiveEdgePopover = useCallback(
    (val: ActiveEdgePopover | ((prev: ActiveEdgePopover) => ActiveEdgePopover)) => {
      useCanvasStore.getState().setActiveEdgePopover(val);
    },
    []
  );
  const setActiveMultiPopover = useCallback(
    (val: ActiveMultiPopover | ((prev: ActiveMultiPopover) => ActiveMultiPopover)) => {
      useCanvasStore.getState().setActiveMultiPopover(val);
    },
    []
  );
  const setActiveSubgraphPopover = useCallback(
    (
      val:
        | 'style'
        | 'group'
        | null
        | ((prev: 'style' | 'group' | null) => 'style' | 'group' | null)
    ) => {
      useCanvasStore.getState().setActiveSubgraphPopover(val);
    },
    []
  );

  const setUnmatchedSubgraphIds = useCallback((ids: string[] | ((prev: string[]) => string[])) => {
    useCanvasStore.getState().setUnmatchedSubgraphIds(ids);
  }, []);

  return {
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
  };
}
