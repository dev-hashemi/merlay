import { useCallback } from 'react';
import { useCanvasStore } from '../../store/canvasStore';
import { useDiagramAst } from './useDiagramAst';
import { ThemePreset } from '../../constants';

export interface UseSubgraphMutationsOptions {
  astHook: ReturnType<typeof useDiagramAst>;
}

export function useSubgraphMutations({ astHook }: UseSubgraphMutationsOptions) {
  const { driver, displayNodes, displaySubgraphs, applyMutation } = astHook;
  const m = driver.mutations;

  const handleAddGroup = useCallback(() => {
    applyMutation((a) => {
      m.createGroup(a, `New ${driver.labels.group}`);
    });
  }, [m, driver, applyMutation]);

  const handleApplySubgraphPreset = useCallback(
    (preset: ThemePreset) => {
      const selectedSubgraphId = useCanvasStore.getState().selectedSubgraphId;
      if (!selectedSubgraphId) return;
      const target = selectedSubgraphId;

      applyMutation((a) => {
        if (!preset.fill && !preset.stroke && !preset.color) {
          m.clearGroupStyle(a, target);
        } else {
          const styles: Record<string, string> = {};
          if (preset.fill) styles['fill'] = preset.fill;
          if (preset.stroke) styles['stroke'] = preset.stroke;
          if (preset.color) styles['color'] = preset.color;
          m.updateGroupStyle(a, target, styles);
        }
      });
    },
    [m, applyMutation]
  );

  const handleUpdateSubgraphCustomStyle = useCallback(
    (property: string, value: string) => {
      const selectedSubgraphId = useCanvasStore.getState().selectedSubgraphId;
      if (!selectedSubgraphId) return;
      const target = selectedSubgraphId;

      applyMutation((a) => {
        const currentStyle = m.getGroupStyle(a, target) || {};
        const updated = { ...currentStyle };
        if (value) {
          updated[property] = value;
        } else {
          delete updated[property];
        }
        m.updateGroupStyle(a, target, Object.keys(updated).length > 0 ? updated : null);
      });
    },
    [m, applyMutation]
  );

  const handleClearSubgraphStyle = useCallback(() => {
    const selectedSubgraphId = useCanvasStore.getState().selectedSubgraphId;
    if (!selectedSubgraphId) return;
    applyMutation((a) => {
      m.clearGroupStyle(a, selectedSubgraphId);
    });
  }, [m, applyMutation]);

  const handleDissolveSubgraph = useCallback(() => {
    const selectedSubgraphId = useCanvasStore.getState().selectedSubgraphId;
    if (!selectedSubgraphId) return;
    applyMutation((a) => {
      m.deleteGroup(a, selectedSubgraphId, false);
    });
    useCanvasStore.getState().setSelectedSubgraphId(null);
    useCanvasStore.getState().setSelectedSubgraphRect(null);
    useCanvasStore.getState().setActiveSubgraphPopover(null);
  }, [m, applyMutation]);

  const handleDeleteSubgraphAll = useCallback(() => {
    const selectedSubgraphId = useCanvasStore.getState().selectedSubgraphId;
    if (!selectedSubgraphId) return;
    applyMutation((a) => {
      m.deleteGroup(a, selectedSubgraphId, true);
    });
    useCanvasStore.getState().setSelectedSubgraphId(null);
    useCanvasStore.getState().setSelectedSubgraphRect(null);
    useCanvasStore.getState().setActiveSubgraphPopover(null);
  }, [m, applyMutation]);

  const handleRenameSubgraph = useCallback(
    (subId: string, label: string) => {
      applyMutation((a) => {
        m.renameGroup(a, subId, label);
      });
    },
    [m, applyMutation]
  );

  const handleMoveNodeToSubgraph = useCallback(
    (nodeId: string, subId: string | null) => {
      applyMutation((a) => {
        m.moveNodeToGroup(a, nodeId, subId);
      }, nodeId);
    },
    [m, applyMutation]
  );

  /**
   * Step a node out of its immediate parent group only: a node nested two
   * or more levels deep lands in its grandparent (depth 1 lands top-level).
   * The membership popover's "None" keeps the full-eject meaning; this is
   * the one-click "get me out of my parent group" action.
   */
  const handleRemoveNodeFromGroup = useCallback(
    (nodeId?: string) => {
      const target =
        nodeId ??
        (() => {
          const ids = useCanvasStore.getState().selectedNodeIds;
          return ids.size === 1 ? Array.from(ids)[0] : null;
        })();
      if (!target) return;
      const parent = displayNodes.get(target)?.subgraphId ?? null;
      if (!parent) return;
      let grandparent: string | null = null;
      for (const [id, sub] of displaySubgraphs.entries()) {
        if (sub.subgraphIds?.includes(parent)) {
          grandparent = id;
          break;
        }
      }
      applyMutation((a) => {
        m.moveNodeToGroup(a, target, grandparent);
      }, target);
    },
    [m, displayNodes, displaySubgraphs, applyMutation]
  );

  const handleCreateGroupWithNode = useCallback(
    (nodeId: string) => {
      applyMutation((a) => {
        m.createGroupWithMembers(a, `New ${driver.labels.group}`, [nodeId]);
      }, nodeId);
    },
    [m, driver, applyMutation]
  );

  return {
    handleAddGroup,
    handleApplySubgraphPreset,
    handleUpdateSubgraphCustomStyle,
    handleClearSubgraphStyle,
    handleDissolveSubgraph,
    handleDeleteSubgraphAll,
    handleRenameSubgraph,
    handleMoveNodeToSubgraph,
    handleRemoveNodeFromGroup,
    handleCreateGroupWithNode,
  };
}
