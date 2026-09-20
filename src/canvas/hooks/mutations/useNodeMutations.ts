import { useCallback, useMemo } from 'react';
import { useCanvasStore } from '../../store/canvasStore';
import { useDiagramAst } from './useDiagramAst';
import { useNodeStyleMutations } from './useNodeStyleMutations';
import { MermaidTheme } from '../../../diagrams/common';

export interface UseNodeMutationsOptions {
  astHook: ReturnType<typeof useDiagramAst>;
  setSelectedNodeId: (id: string | null) => void;
  updateSelectedNodeHalo: (targets?: string | null | Set<string> | string[]) => void;
}

export function useNodeMutations({
  astHook,
  setSelectedNodeId,
  updateSelectedNodeHalo,
}: UseNodeMutationsOptions) {
  const { driver, ast, applyMutation } = astHook;
  const m = driver.mutations;
  const anchors = m.anchors;

  const getSelectedNodeId = () => {
    const ids = useCanvasStore.getState().selectedNodeIds;
    return ids.size === 1 ? Array.from(ids)[0] : null;
  };

  const styleMutations = useNodeStyleMutations({
    driver,
    ast,
    applyMutation,
    getSelectedNodeId,
  });

  const handleSproutNextStep = useCallback(
    (parentId: string) => {
      let createdChildId: string | null = null;
      applyMutation((currentAst) => {
        createdChildId = m.addChildNode(currentAst, parentId, driver.labels.addChild);
      }, parentId);
      if (createdChildId) {
        setSelectedNodeId(createdChildId);
      }
    },
    [m, driver, applyMutation, setSelectedNodeId]
  );

  const handleDeleteSelectedNode = useCallback(() => {
    const selectedNodeId = getSelectedNodeId();
    if (!selectedNodeId) return;
    const targetId = selectedNodeId;
    const starKind = useCanvasStore.getState().selectedStarKind;

    // Clear selection immediately
    setSelectedNodeId(null);
    useCanvasStore.getState().setSelectedNodeRect(null);
    useCanvasStore.getState().setActiveNodePopover(null);
    updateSelectedNodeHalo(new Set());
    useCanvasStore.getState().setSelectedStarKind(null);

    if (anchors?.isAnchor(targetId)) {
      applyMutation((a) => {
        const compositeId = targetId.startsWith('[*]:') ? targetId.slice(4) : undefined;
        anchors.delete(a, starKind ?? null, compositeId);
      });
      return;
    }
    applyMutation((a) => {
      m.deleteNode(a, targetId);
    });
  }, [anchors, m, setSelectedNodeId, updateSelectedNodeHalo, applyMutation]);

  const handleUpdateNodeKind = useCallback(
    (kind: string, specificId?: string) => {
      const state = useCanvasStore.getState();
      const targets = specificId
        ? [specificId]
        : state.selectedNodeIds.size > 1
        ? Array.from(state.selectedNodeIds)
        : getSelectedNodeId()
        ? [getSelectedNodeId()!]
        : [];
      if (targets.length === 0) return;
      applyMutation((a) => {
        m.updateNodesKind(a, targets, kind);
      }, specificId || getSelectedNodeId() || undefined);
      useCanvasStore.getState().setActiveNodePopover(null);
    },
    [m, applyMutation]
  );

  const handleBatchUpdateNodeKind = useCallback(
    (kind: string) => {
      const state = useCanvasStore.getState();
      const filtered = Array.from(state.selectedNodeIds).filter(
        (id) => !(anchors && anchors.isAnchor(id))
      );
      if (filtered.length === 0) return;
      applyMutation((a) => {
        m.updateNodesKind(a, filtered, kind);
      });
      useCanvasStore.getState().setActiveMultiPopover(null);
    },
    [anchors, m, applyMutation]
  );

  const handleAddStandaloneStep = useCallback(() => {
    let createdNodeId: string | null = null;
    applyMutation((a) => {
      createdNodeId = m.addNode(a, `New ${driver.labels.node}`);
    });
    if (createdNodeId) {
      setSelectedNodeId(createdNodeId);
    }
  }, [m, driver, applyMutation, setSelectedNodeId]);

  const handleSetNodeMembers = useCallback(
    (nodeId: string, kind: 'attribute' | 'method', members: string[]) => {
      if (!m.setNodeMembers) return;
      applyMutation((a) => {
        m.setNodeMembers!(a, nodeId, kind, members);
      }, nodeId);
    },
    [m, applyMutation]
  );

  const handleAddNodeMember = useCallback(
    (nodeId: string, kind: 'attribute' | 'method', rawText?: string, afterIndex?: number) => {
      if (!m.addNodeMember) return;
      applyMutation((a) => {
        m.addNodeMember!(a, nodeId, kind, rawText, afterIndex);
      }, nodeId);
    },
    [m, applyMutation]
  );

  const handleUpdateNodeMember = useCallback(
    (nodeId: string, kind: 'attribute' | 'method', index: number, rawText: string) => {
      if (!m.updateNodeMember) return;
      applyMutation((a) => {
        m.updateNodeMember!(a, nodeId, kind, index, rawText);
      }, nodeId);
    },
    [m, applyMutation]
  );

  const handleDeleteNodeMember = useCallback(
    (nodeId: string, kind: 'attribute' | 'method', index: number) => {
      if (!m.deleteNodeMember) return;
      applyMutation((a) => {
        m.deleteNodeMember!(a, nodeId, kind, index);
      }, nodeId);
    },
    [m, applyMutation]
  );

  const handleToggleDirection = useCallback(() => {
    if (!driver.capabilities.supportsDirection) return;
    const currentDir = m.getDirection(ast) || 'TD';
    const nextDir = currentDir === 'LR' ? 'TD' : 'LR';
    applyMutation((a) => {
      m.setDirection(a, nextDir);
    });
  }, [driver, m, ast, applyMutation]);

  const currentTheme = useMemo(() => {
    return m.getTheme ? m.getTheme(ast) : undefined;
  }, [m, ast]);

  const handleSetTheme = useCallback(
    (theme: MermaidTheme | null) => {
      applyMutation((a) => {
        m.setTheme?.(a, theme);
      });
    },
    [m, applyMutation]
  );

  const handleAddStartState = useCallback(
    (compositeId?: string) => {
      if (!anchors) return null;
      let createdId: string | null = null;
      applyMutation((a) => {
        createdId = anchors.add(a, 'start', compositeId);
      });
      if (createdId) {
        setSelectedNodeId(createdId);
      }
      return createdId;
    },
    [anchors, applyMutation, setSelectedNodeId]
  );

  const handleAddEndState = useCallback(
    (compositeId?: string) => {
      if (!anchors) return null;
      let createdId: string | null = null;
      applyMutation((a) => {
        createdId = anchors.add(a, 'end', compositeId);
      });
      if (createdId) {
        setSelectedNodeId(createdId);
      }
      return createdId;
    },
    [anchors, applyMutation, setSelectedNodeId]
  );

  const handleConnectToEnd = useCallback(() => {
    const selectedNodeId = getSelectedNodeId();
    if (!selectedNodeId || !anchors) return;
    applyMutation((a) => {
      anchors.connectToEnd(a, selectedNodeId);
    });
  }, [anchors, applyMutation]);

  return {
    handleSproutNextStep,
    handleDeleteSelectedNode,
    handleUpdateNodeKind,
    handleBatchUpdateNodeKind,
    ...styleMutations,
    handleAddStandaloneStep,
    handleSetNodeMembers,
    handleAddNodeMember,
    handleUpdateNodeMember,
    handleDeleteNodeMember,
    handleToggleDirection,
    currentTheme,
    handleSetTheme,
    handleAddStartState,
    handleAddEndState,
    handleConnectToEnd,
    hasStartState: anchors ? anchors.has(ast, 'start') : false,
    hasEndState: anchors ? anchors.has(ast, 'end') : false,
  };
}
