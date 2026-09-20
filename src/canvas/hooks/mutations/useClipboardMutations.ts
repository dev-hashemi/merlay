import { useCallback, useRef } from 'react';
import { useCanvasStore } from '../../store/canvasStore';
import { useDiagramAst } from './useDiagramAst';

export interface UseClipboardMutationsOptions {
  astHook: ReturnType<typeof useDiagramAst>;
  updateSelectedNodeHalo: (targets?: string | null | Set<string> | string[]) => void;
  updateSelectedEdgeHalo: (targets?: string | null | Set<string> | string[]) => void;
}

export function useClipboardMutations({
  astHook,
  updateSelectedNodeHalo,
  updateSelectedEdgeHalo,
}: UseClipboardMutationsOptions) {
  const { driver, applyMutation } = astHook;
  const m = driver.mutations;
  const anchors = m.anchors;
  const clipboardNodesRef = useRef<string[]>([]);

  const applyDuplication = useCallback(
    (nodeIds: Iterable<string>) => {
      applyMutation((currentAst) => {
        const result = m.duplicateNodes(currentAst, nodeIds);
        if (result.nodeIds.length > 0) {
          const newSet = new Set(result.nodeIds);
          const newEdges = new Set(result.edgeIds);
          useCanvasStore.getState().setSelectedNodeIds(newSet);
          useCanvasStore.getState().setSelectedEdgeIds(newEdges);
          updateSelectedNodeHalo(newSet);
          updateSelectedEdgeHalo(newEdges);
        }
      });
    },
    [m, applyMutation, updateSelectedNodeHalo, updateSelectedEdgeHalo]
  );

  const handleDuplicateSelected = useCallback(() => {
    const state = useCanvasStore.getState();
    if (state.selectedNodeIds.size === 0) return;
    const filteredIds = Array.from(state.selectedNodeIds).filter(
      (id) => !(anchors && anchors.isAnchor(id))
    );
    if (filteredIds.length === 0) return;
    applyDuplication(filteredIds);
  }, [anchors, applyDuplication]);

  const handleCopySelected = useCallback(() => {
    const state = useCanvasStore.getState();
    if (state.selectedNodeIds.size > 0) {
      const filtered = Array.from(state.selectedNodeIds).filter(
        (id) => !(anchors && anchors.isAnchor(id))
      );
      if (filtered.length > 0) clipboardNodesRef.current = filtered;
    }
  }, [anchors]);

  const handlePasteSelected = useCallback(() => {
    if (clipboardNodesRef.current.length === 0) return;
    applyDuplication(clipboardNodesRef.current);
  }, [applyDuplication]);

  return {
    handleDuplicateSelected,
    handleCopySelected,
    handlePasteSelected,
  };
}
