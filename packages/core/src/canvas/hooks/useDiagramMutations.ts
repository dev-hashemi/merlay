/**
 * Diagram Mutations Coordinator Hook
 *
 * Coordinates diagram AST mutations across nodes, edges, subgraphs/groups,
 * batch multi-selections, and clipboard operations.
 *
 * Decoupled from React prop-drilling by delegating to modular sub-hooks:
 * - useNodeMutations: Sprouting, kind changes, node deletion, styling, direction/theme, anchors
 * - useEdgeMutations: Connecting, edge reversal, edge deletion, styling, labels
 * - useSubgraphMutations: Group creation, renaming, style, dissolve
 * - useBatchMutations: Multi-node/edge batch operations
 * - useClipboardMutations: Copy, paste, duplicate
 */

import { useCallback } from 'react';
import { useCanvasStore } from '../store/canvasStore';
import { useDiagramAst } from './mutations/useDiagramAst';
import { useNodeMutations } from './mutations/useNodeMutations';
import { useEdgeMutations } from './mutations/useEdgeMutations';
import { useSubgraphMutations } from './mutations/useSubgraphMutations';
import { useBatchMutations } from './mutations/useBatchMutations';
import { useClipboardMutations } from './mutations/useClipboardMutations';

export interface UseDiagramMutationsOptions {
  astHook: ReturnType<typeof useDiagramAst>;
  updateSelectedNodeHalo?: (targets?: string | null | Set<string> | string[]) => void;
  updateSelectedEdgeHalo?: (targets?: string | null | Set<string> | string[]) => void;
  // Backward compatibility: allow any legacy options to be passed without error
  [key: string]: unknown;
}

export function useDiagramMutations(options: UseDiagramMutationsOptions) {
  const { astHook, updateSelectedNodeHalo = () => {}, updateSelectedEdgeHalo = () => {} } =
    options;

  const {
    driver,
    ast,
    syntaxError,
    setSyntaxError,
    displayNodes,
    displayEdges,
    displaySubgraphs,
    displayDirection,
    applyMutation,
  } = astHook;

  const setSelectedNodeId = useCallback(
    (id: string | null) => {
      const newSet = id ? new Set([id]) : new Set<string>();
      useCanvasStore.getState().setSelectedNodeIds(newSet);
      updateSelectedNodeHalo(newSet);
      if (!id) {
        useCanvasStore.getState().setSelectedNodeRect(null);
      }
    },
    [updateSelectedNodeHalo]
  );

  const setSelectedEdgeId = useCallback(
    (id: string | null) => {
      const newSet = id ? new Set([id]) : new Set<string>();
      useCanvasStore.getState().setSelectedEdgeIds(newSet);
      updateSelectedEdgeHalo(newSet);
      if (!id) {
        useCanvasStore.getState().setSelectedEdgePos(null);
      }
    },
    [updateSelectedEdgeHalo]
  );

  const nodeMutations = useNodeMutations({
    astHook,
    setSelectedNodeId,
    updateSelectedNodeHalo,
  });

  const edgeMutations = useEdgeMutations({
    astHook,
    setSelectedEdgeId,
    updateSelectedEdgeHalo,
    setSelectedNodeId,
  });

  const subgraphMutations = useSubgraphMutations({
    astHook,
  });

  const batchMutations = useBatchMutations({
    astHook,
    updateSelectedNodeHalo,
    updateSelectedEdgeHalo,
  });

  const clipboardMutations = useClipboardMutations({
    astHook,
    updateSelectedNodeHalo,
    updateSelectedEdgeHalo,
  });

  return {
    // Model state
    driver,
    ast,
    displayNodes,
    displayEdges,
    displaySubgraphs,
    displayDirection,
    syntaxError,
    setSyntaxError,
    applyMutation,

    // Node operations
    ...nodeMutations,

    // Edge operations
    ...edgeMutations,

    // Group operations
    ...subgraphMutations,

    // Batch operations
    ...batchMutations,

    // Clipboard operations
    ...clipboardMutations,
  };
}
