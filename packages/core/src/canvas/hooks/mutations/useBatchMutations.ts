import { useCallback } from 'react';
import { useCanvasStore } from '../../store/canvasStore';
import { useDiagramAst } from './useDiagramAst';
import { ThemePreset } from '../../constants';

export interface UseBatchMutationsOptions {
  astHook: ReturnType<typeof useDiagramAst>;
  updateSelectedNodeHalo: (targets?: string | null | Set<string> | string[]) => void;
  updateSelectedEdgeHalo: (targets?: string | null | Set<string> | string[]) => void;
}

export function useBatchMutations({
  astHook,
  updateSelectedNodeHalo,
  updateSelectedEdgeHalo,
}: UseBatchMutationsOptions) {
  const { driver, applyMutation } = astHook;
  const m = driver.mutations;
  const anchors = m.anchors;

  const handleBatchDeleteSelected = useCallback(() => {
    const state = useCanvasStore.getState();
    if (state.selectedSubgraphId) {
      applyMutation((a) => {
        m.deleteGroup(a, state.selectedSubgraphId!, false);
      });
      useCanvasStore.getState().setSelectedSubgraphId(null);
      useCanvasStore.getState().setSelectedSubgraphRect(null);
      useCanvasStore.getState().setActiveSubgraphPopover(null);
      return;
    }

    if (state.selectedNodeIds.size === 0 && state.selectedEdgeIds.size === 0) return;
    const nodesToDelete = Array.from(state.selectedNodeIds);
    const edgesToDelete = Array.from(state.selectedEdgeIds);

    useCanvasStore.getState().clearSelection();
    updateSelectedNodeHalo(new Set());
    updateSelectedEdgeHalo(new Set());

    applyMutation((a) => {
      if (nodesToDelete.length > 0) {
        m.deleteNodes(a, nodesToDelete);
      }
      if (edgesToDelete.length > 0) {
        m.deleteEdges(a, edgesToDelete);
      }
    });
  }, [m, applyMutation, updateSelectedNodeHalo, updateSelectedEdgeHalo]);

  const handleBatchApplyThemePreset = useCallback(
    (preset: ThemePreset) => {
      const state = useCanvasStore.getState();
      const filtered = Array.from(state.selectedNodeIds).filter(
        (id) => !(anchors && anchors.isAnchor(id))
      );
      const edgeIds = Array.from(state.selectedEdgeIds);

      applyMutation((a) => {
        if (filtered.length > 0) {
          if (!preset.fill && !preset.stroke && !preset.color) {
            m.clearNodesStyle(a, filtered);
          } else {
            const styles: Record<string, string> = {};
            if (preset.fill) styles['fill'] = preset.fill;
            if (preset.stroke) styles['stroke'] = preset.stroke;
            if (preset.color) styles['color'] = preset.color;
            m.updateNodesStyle(a, filtered, styles);
          }
        }
        if (edgeIds.length > 0 && m.updateEdgesStyle && m.clearEdgesStyle) {
          if (!preset.stroke) {
            m.clearEdgesStyle(a, edgeIds);
          } else {
            const edgeStyles: Record<string, string> = { stroke: preset.stroke };
            m.updateEdgesStyle(a, edgeIds, edgeStyles);
          }
        }
      });
    },
    [anchors, m, applyMutation]
  );

  const handleBatchClearStyle = useCallback(() => {
    const state = useCanvasStore.getState();
    const filtered = Array.from(state.selectedNodeIds).filter(
      (id) => !(anchors && anchors.isAnchor(id))
    );
    const edgeIds = Array.from(state.selectedEdgeIds);

    applyMutation((a) => {
      if (filtered.length > 0) {
        m.clearNodesStyle(a, filtered);
      }
      if (edgeIds.length > 0 && m.clearEdgesStyle) {
        m.clearEdgesStyle(a, edgeIds);
      }
    });
  }, [anchors, m, applyMutation]);

  const handleBatchUpdateStyle = useCallback(
    (property: string, value: string) => {
      const state = useCanvasStore.getState();
      const filtered = Array.from(state.selectedNodeIds).filter(
        (id) => !(anchors && anchors.isAnchor(id))
      );
      const edgeIds = Array.from(state.selectedEdgeIds);

      applyMutation((a) => {
        for (const nodeId of filtered) {
          const currentStyle = m.getNodeStyle(a, nodeId) || {};
          const updated = { ...currentStyle };
          if (value) {
            updated[property] = value;
          } else {
            delete updated[property];
          }
          m.updateNodeStyle(a, nodeId, Object.keys(updated).length > 0 ? updated : null);
        }
        if (edgeIds.length > 0 && m.updateEdgeStyle && m.getEdgeStyle) {
          for (const edgeId of edgeIds) {
            const currentStyle = m.getEdgeStyle(a, edgeId) || {};
            const updated = { ...currentStyle };
            if (value) {
              updated[property] = value;
            } else {
              delete updated[property];
            }
            m.updateEdgeStyle(a, edgeId, Object.keys(updated).length > 0 ? updated : null);
          }
        }
      });
    },
    [anchors, m, applyMutation]
  );

  const handleBatchUpdateEdgeType = useCallback(
    (newType: string) => {
      const state = useCanvasStore.getState();
      if (!m.updateEdgesType || state.selectedEdgeIds.size === 0) return;
      applyMutation((a) => {
        m.updateEdgesType!(a, Array.from(state.selectedEdgeIds), newType);
      });
      useCanvasStore.getState().setActiveMultiPopover(null);
    },
    [m, applyMutation]
  );

  const handleBatchCreateGroup = useCallback(() => {
    const state = useCanvasStore.getState();
    const filtered = Array.from(state.selectedNodeIds).filter(
      (id) => !(anchors && anchors.isAnchor(id))
    );
    if (filtered.length === 0) return;
    applyMutation((a) => {
      m.createGroupWithMembers(a, `New ${driver.labels.group}`, filtered);
    });
    useCanvasStore.getState().clearSelection();
    updateSelectedNodeHalo(new Set());
    updateSelectedEdgeHalo(new Set());
  }, [anchors, m, driver, applyMutation, updateSelectedNodeHalo, updateSelectedEdgeHalo]);

  const handleBatchUngroup = useCallback(() => {
    const state = useCanvasStore.getState();
    if (state.selectedNodeIds.size === 0) return;
    applyMutation((a) => {
      m.moveNodesToGroup(a, Array.from(state.selectedNodeIds), null);
    });
  }, [m, applyMutation]);

  return {
    handleBatchDeleteSelected,
    handleBatchApplyThemePreset,
    handleBatchClearStyle,
    handleBatchUpdateStyle,
    handleBatchUpdateCustomStyle: handleBatchUpdateStyle,
    handleBatchUpdateEdgeType,
    handleBatchCreateGroup,
    handleBatchGroupSelected: handleBatchCreateGroup,
    handleBatchUngroup,
    handleBatchUngroupSelected: handleBatchUngroup,
  };
}
