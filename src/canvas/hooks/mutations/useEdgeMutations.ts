import { useCallback } from 'react';
import { useCanvasStore } from '../../store/canvasStore';
import { useDiagramAst } from './useDiagramAst';
import { EdgeThemePreset } from '../../constants';
import { ArrowType } from '../../../diagrams/viewModel';

export interface UseEdgeMutationsOptions {
  astHook: ReturnType<typeof useDiagramAst>;
  setSelectedEdgeId: (id: string | null) => void;
  updateSelectedEdgeHalo: (targets?: string | null | Set<string> | string[]) => void;
  setSelectedNodeId: (id: string | null) => void;
}

export function useEdgeMutations({
  astHook,
  setSelectedEdgeId,
  updateSelectedEdgeHalo,
  setSelectedNodeId,
}: UseEdgeMutationsOptions) {
  const { driver, ast, applyMutation } = astHook;
  const m = driver.mutations;

  const getSelectedEdgeId = () => {
    const ids = useCanvasStore.getState().selectedEdgeIds;
    return ids.size === 1 ? Array.from(ids)[0] : null;
  };

  const handleChangeEdgeType = useCallback(
    (newType: string) => {
      const selectedEdgeId = getSelectedEdgeId();
      if (!selectedEdgeId || !m.updateEdgeType) return;
      applyMutation((a) => {
        m.updateEdgeType!(a, selectedEdgeId, newType);
      });
      const pos = useCanvasStore.getState().selectedEdgePos;
      if (pos) {
        useCanvasStore.getState().setSelectedEdgePos({ ...pos, arrowType: newType as ArrowType });
      }
    },
    [m, applyMutation]
  );

  const handleReverseEdge = useCallback(() => {
    const selectedEdgeId = getSelectedEdgeId();
    if (!selectedEdgeId) return;
    let newEdgeId: string | null = null;
    applyMutation((a) => {
      newEdgeId = m.reverseEdge(a, selectedEdgeId);
    });
    if (newEdgeId) {
      setSelectedEdgeId(newEdgeId);
      const pos = useCanvasStore.getState().selectedEdgePos;
      if (pos) {
        useCanvasStore.getState().setSelectedEdgePos({
          ...pos,
          from: pos.to,
          to: pos.from,
        });
      }
    }
  }, [m, applyMutation, setSelectedEdgeId]);

  const handleInsertNodeOnEdge = useCallback(
    (edgeId: string) => {
      let createdNodeId: string | null = null;
      applyMutation((a) => {
        createdNodeId = m.insertNodeOnEdge(a, edgeId, `New ${driver.labels.node}`);
      });
      setSelectedEdgeId(null);
      useCanvasStore.getState().setSelectedEdgePos(null);
      if (createdNodeId) {
        setSelectedNodeId(createdNodeId);
      }
    },
    [m, driver, applyMutation, setSelectedEdgeId, setSelectedNodeId]
  );

  const handleDeleteSelectedEdge = useCallback(() => {
    const selectedEdgeId = getSelectedEdgeId();
    if (!selectedEdgeId) return;
    const targetEdgeId = selectedEdgeId;
    useCanvasStore.getState().setSelectedEdgeIds(new Set());
    useCanvasStore.getState().setSelectedEdgePos(null);
    updateSelectedEdgeHalo(new Set());
    applyMutation((a) => {
      m.deleteEdge(a, targetEdgeId);
    });
  }, [m, updateSelectedEdgeHalo, applyMutation]);

  const handleUpdateEdgeLabel = useCallback(
    (newLabel: string) => {
      const selectedEdgeId = getSelectedEdgeId();
      if (!selectedEdgeId) return;
      applyMutation((a) => {
        m.updateEdgeLabel(a, selectedEdgeId, newLabel);
      });
      const pos = useCanvasStore.getState().selectedEdgePos;
      if (pos) {
        useCanvasStore.getState().setSelectedEdgePos({ ...pos, label: newLabel });
      }
    },
    [m, applyMutation]
  );

  const handleApplyEdgePreset = useCallback(
    (preset: EdgeThemePreset) => {
      const selectedEdgeId = getSelectedEdgeId();
      if (!selectedEdgeId || !m.updateEdgeStyle || !m.clearEdgeStyle) return;
      const target = selectedEdgeId;

      applyMutation((a) => {
        if (!preset.stroke) {
          m.clearEdgeStyle!(a, target);
        } else {
          const styles: Record<string, string> = { stroke: preset.stroke };
          m.updateEdgeStyle!(a, target, styles);
        }
      });
    },
    [m, applyMutation]
  );

  const handleUpdateEdgeCustomStyle = useCallback(
    (property: string, value: string) => {
      const selectedEdgeId = getSelectedEdgeId();
      if (!selectedEdgeId || !m.updateEdgeStyle || !m.getEdgeStyle) return;
      const target = selectedEdgeId;

      applyMutation((a) => {
        const currentStyle = m.getEdgeStyle!(a, target) || {};
        const updated = { ...currentStyle };
        if (value) {
          updated[property] = value;
        } else {
          delete updated[property];
        }
        m.updateEdgeStyle!(a, target, Object.keys(updated).length > 0 ? updated : null);
      });
    },
    [m, applyMutation]
  );

  const handleClearEdgeStyle = useCallback(
    (specificId?: unknown) => {
      const target =
        (typeof specificId === 'string' && specificId ? specificId : null) ||
        getSelectedEdgeId();
      if (!target || !m.clearEdgeStyle) return;
      applyMutation((a) => {
        m.clearEdgeStyle!(a, target);
      });
    },
    [m, applyMutation]
  );

  const handleSetDefaultEdgeStyle = useCallback(
    (customStyle?: unknown) => {
      if (!m.updateDefaultEdgeStyle) return;
      const target = getSelectedEdgeId();
      applyMutation((a) => {
        const isStyleMap =
          customStyle &&
          typeof customStyle === 'object' &&
          !('nativeEvent' in customStyle) &&
          !('isTrusted' in customStyle) &&
          !('bubbles' in customStyle);

        const styleToSet =
          (isStyleMap ? (customStyle as Record<string, string>) : undefined) ||
          (target && m.getEdgeStyle ? m.getEdgeStyle(a, target) : undefined);

        if (styleToSet && Object.keys(styleToSet).length > 0) {
          m.updateDefaultEdgeStyle!(a, styleToSet);
          const state = useCanvasStore.getState();
          const edgeTargets =
            state.selectedEdgeIds.size > 0
              ? Array.from(state.selectedEdgeIds)
              : target
              ? [target]
              : [];
          if (edgeTargets.length > 0 && m.clearEdgesStyle) {
            m.clearEdgesStyle(a, edgeTargets);
          } else if (target && m.clearEdgeStyle) {
            m.clearEdgeStyle(a, target);
          }
        }
      });
    },
    [m, applyMutation]
  );

  const handleClearDefaultEdgeStyle = useCallback(() => {
    if (!m.clearDefaultEdgeStyle) return;
    applyMutation((a) => {
      m.clearDefaultEdgeStyle!(a);
    });
  }, [m, applyMutation]);

  return {
    handleChangeEdgeType,
    handleReverseEdge,
    handleInsertNodeOnEdge,
    handleDeleteSelectedEdge,
    handleUpdateEdgeLabel,
    handleApplyEdgePreset,
    handleUpdateEdgeCustomStyle,
    handleClearEdgeStyle,
    handleSetDefaultEdgeStyle,
    handleClearDefaultEdgeStyle,
    hasDefaultEdgeStyle: Boolean(m.getDefaultEdgeStyle?.(ast)),
  };
}
