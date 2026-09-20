/**
 * Native Mermaid View with Direct Structural Manipulation Overlay
 * Renders Obsidian's exact native Mermaid SVG (100% parity, zero layout simulation)
 * with direct-manipulation node sprouting, drag-to-connect, inline label editing, and camera stabilization.
 * All diagram-specific behavior comes from the DiagramDriver — no type branching here.
 */

import React, { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import { detectDiagramType } from '../diagrams/registry';
import { CursorMode, NativeMermaidViewProps, Rect } from './types';
import { useHistory } from './useHistory';
import { applyDropTargetHalo } from './renderer/selectionHalo';

import { useCanvasCamera } from './hooks/useCanvasCamera';
import { useCanvasSelection } from './hooks/useCanvasSelection';
import { useMarqueeSelection } from './hooks/useMarqueeSelection';
import { useInlineEditing } from './hooks/useInlineEditing';
import { useDiagramAst } from './hooks/mutations/useDiagramAst';
import { useDiagramMutations } from './hooks/useDiagramMutations';
import { useCanvasShortcuts } from './hooks/useCanvasShortcuts';
import { useCanvasMouseInteractions } from './hooks/useCanvasMouseInteractions';
import { useCanvasRenderer } from './hooks/useCanvasRenderer';

import { CanvasTopBar } from './components/CanvasTopBar';
import { CanvasOverlays } from './components/CanvasOverlays';
import { SelectionMarquee } from './components/SelectionMarquee';
import { SyntaxDrawer } from './components/SyntaxDrawer';
import { useCanvasStore } from './store/canvasStore';

export type { NativeMermaidViewProps };

function getCompartmentRect(
  nodeEl: Element,
  kind: 'attribute' | 'method',
  getLocalRect: (el: Element) => Rect | null
): Rect | null {
  const nodeRect = getLocalRect(nodeEl);
  if (!nodeRect) return null;

  const targetGroup = nodeEl.querySelector(
    kind === 'attribute' ? '.members-group' : '.methods-group'
  );
  if (targetGroup && targetGroup.children.length > 0) {
    const groupRect = getLocalRect(targetGroup);
    if (groupRect && groupRect.height > 10) {
      return {
        x: nodeRect.x + 6,
        y: Math.max(nodeRect.y, groupRect.y - 2),
        width: Math.max(nodeRect.width - 12, 140),
        height: Math.max(groupRect.height + 8, 56),
      };
    }
  }

  // Fallback to dividers if present
  const dividers = Array.from(nodeEl.querySelectorAll('.divider'));
  if (dividers.length >= 2) {
    const d0Rect = getLocalRect(dividers[0]);
    const d1Rect = getLocalRect(dividers[1]);
    if (d0Rect && d1Rect) {
      if (kind === 'attribute') {
        const top = d0Rect.y + 2;
        const height = Math.max(d1Rect.y - top, 56);
        return {
          x: nodeRect.x + 6,
          y: top,
          width: Math.max(nodeRect.width - 12, 140),
          height,
        };
      } else {
        const top = d1Rect.y + 2;
        const height = Math.max(nodeRect.y + nodeRect.height - top - 4, 56);
        return {
          x: nodeRect.x + 6,
          y: top,
          width: Math.max(nodeRect.width - 12, 140),
          height,
        };
      }
    }
  }

  // Ratio-based fallback: top 35% header, 35%-65% attributes, 65%-100% methods
  if (kind === 'attribute') {
    return {
      x: nodeRect.x + 6,
      y: nodeRect.y + nodeRect.height * 0.35,
      width: Math.max(nodeRect.width - 12, 140),
      height: Math.max(nodeRect.height * 0.3, 56),
    };
  } else {
    return {
      x: nodeRect.x + 6,
      y: nodeRect.y + nodeRect.height * 0.65,
      width: Math.max(nodeRect.width - 12, 140),
      height: Math.max(nodeRect.height * 0.35, 56),
    };
  }
}

export const NativeMermaidView: React.FC<NativeMermaidViewProps> = ({
  app,
  initialCode,
  onCodeChange,
  isFullscreen: externalIsFullscreen,
  onToggleFullscreen,
}) => {
  const [code, setCode] = useState<string>(
    initialCode || 'flowchart LR\n    A["Start"] --> B["Process"]\n    B --> C["End"]'
  );
  const diagramType = useMemo<ReturnType<typeof detectDiagramType>>(
    () => detectDiagramType(code),
    [code]
  );

  const [isFullscreen, setIsFullscreen] = useState<boolean>(externalIsFullscreen ?? false);
  const handleToggleFullscreen = onToggleFullscreen
    ? () => {
        onToggleFullscreen();
        setIsFullscreen((prev) => !prev);
      }
    : undefined;

  // History Stack
  const history = useHistory(code);
  const pushHistoryState = history.pushState;
  const undoHistory = history.undo;
  const redoHistory = history.redo;
  const resetHistory = history.reset;

  // Primary Canvas DOM Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const svgMountRef = useRef<HTMLDivElement>(null);

  // 1. Camera & Viewport
  const {
    zoom,
    pan,
    isPanning,
    zoomRef,
    getLocalRect,
    getLocalPoint,
    pinNodeForCamera,
    stabilizeCamera,
    handleWheel,
    handleFitView,
    startPan,
    updatePan,
    endPan,
    startPinch,
    updatePinch,
    endPinch,
    pinchRef,
  } = useCanvasCamera({ containerRef, worldRef, svgMountRef });

  // Active touch pointers for pinch-zoom. Single-pointer gestures keep flowing
  // to the pointer-interaction hook; the moment a second finger lands, the
  // in-progress single gesture is cancelled and the pair drives the camera.
  const activePointersRef = useRef<Map<number, { x: number; y: number }>>(
    new Map()
  );

  const pinchStats = (
    points: Map<number, { x: number; y: number }>
  ): { dist: number; midX: number; midY: number } => {
    const [p1, p2] = Array.from(points.values());
    return {
      dist: Math.hypot(p2.x - p1.x, p2.y - p1.y),
      midX: (p1.x + p2.x) / 2,
      midY: (p1.y + p2.y) / 2,
    };
  };

  // 2. AST State & Driver Projections (single active AST owned by the driver)
  const astHook = useDiagramAst({
    code,
    setCode,
    onCodeChange,
    pushHistoryState,
    diagramType,
    pinNodeForCamera,
  });
  const driver = astHook.driver;
  const isEditable = driver.capabilities.editable !== false;
  // Touch devices get tap/double-tap/long-press copy and gestures (no hover).
  const isCoarsePointer =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches;

  // 3. Selection & Halos
  const selection = useCanvasSelection({
    svgMountRef,
    getLocalRect,
    displayDirection: astHook.displayDirection,
  });

  // 4. Diagram Mutations (driver-dispatched via Zustand)
  const mutations = useDiagramMutations({
    astHook,
    updateSelectedNodeHalo: selection.updateSelectedNodeHalo,
    updateSelectedEdgeHalo: selection.updateSelectedEdgeHalo,
  });

  // 5. Marquee Selection
  const marquee = useMarqueeSelection({
    worldRef,
    svgMountRef,
    zoomRef,
    getLocalRect,
    onSelectionChange: (nodes, edges) => {
      if (!nodes.has('[*]')) {
        useCanvasStore.getState().setSelectedStarKind(null);
      }
      selection.setSelectedNodeIds(nodes);
      selection.setSelectedEdgeIds(edges);
      selection.updateSelectedNodeHalo(nodes);
      selection.updateSelectedEdgeHalo(edges);
    },
    selectedNodeIdsRef: selection.selectedNodeIdsRef,
    selectedEdgeIdsRef: selection.selectedEdgeIdsRef,
  });

  // 6. Inline Text Editing
  const inlineEditing = useInlineEditing({
    displayNodes: mutations.displayNodes,
    displayEdges: mutations.displayEdges,
    displaySubgraphs: mutations.displaySubgraphs,
    getLocalRect,
    onCommitNodeLabel: (nodeId, newLabel) => {
      mutations.applyMutation(
        (a) => {
          driver.mutations.updateNodeLabel(a, nodeId, newLabel);
        },
        nodeId
      );
    },
    onCommitEdgeLabel: mutations.handleUpdateEdgeLabel,
    onCommitSubgraphLabel: mutations.handleRenameSubgraph,
    onClearOtherSelections: selection.isolateSelection,
    onCommitMemberSection: (nodeId, kind, lines) => {
      mutations.handleSetNodeMembers(nodeId, kind, lines);
    },
  });

  // 7. Viewport Modes & State
  const cursorMode = useCanvasStore((s) => s.cursorMode);
  const setCursorMode = useCallback((mode: CursorMode) => {
    useCanvasStore.getState().setCursorMode(mode);
  }, []);
  const showCodeDrawer = useCanvasStore((s) => s.showCodeDrawer);
  const setShowCodeDrawer = useCallback((show: boolean | ((prev: boolean) => boolean)) => {
    useCanvasStore.getState().setShowCodeDrawer(show);
  }, []);

  // SyntaxDrawer edits bypass applyMutation, so record a single history
  // entry when the drawer closes instead of flooding the stack per keystroke.
  // Without this, undo after a drawer edit jumps to the pre-drawer state
  // and silently discards the drawer text.
  const drawerOpenCodeRef = useRef<string | null>(null);
  const wasDrawerOpenRef = useRef(showCodeDrawer);
  useEffect(() => {
    if (showCodeDrawer && !wasDrawerOpenRef.current) {
      drawerOpenCodeRef.current = code;
    } else if (!showCodeDrawer && wasDrawerOpenRef.current) {
      if (drawerOpenCodeRef.current !== null && drawerOpenCodeRef.current !== code) {
        pushHistoryState(code);
      }
      drawerOpenCodeRef.current = null;
    }
    wasDrawerOpenRef.current = showCodeDrawer;
  });

  const handleOpenMemberSection = useCallback(
    (nodeId: string, kind: 'attribute' | 'method', nodeEl: Element) => {
      const caps = driver.mutations.getNodeMemberCapabilities?.(astHook.ast, nodeId);
      if (kind === 'attribute' && caps && !caps.supportsAttributes) return;
      if (kind === 'method' && caps && !caps.supportsMethods) return;

      const members = driver.mutations.getNodeMembers?.(astHook.ast, nodeId) || {
        attributes: [],
        methods: [],
      };
      const lines = kind === 'attribute' ? members.attributes : members.methods;
      const initialText = lines.join('\n');

      const pos = getCompartmentRect(nodeEl, kind, getLocalRect);
      if (pos) {
        inlineEditing.startEditingMemberSection(nodeId, kind, pos, initialText);
      }
    },
    [driver, astHook.ast, getLocalRect, inlineEditing]
  );

  const handleAddNodeAttribute = useCallback(
    (nodeId: string) => {
      const nodeEl = svgMountRef.current?.querySelector(
        `[data-mermaid-node-id="${nodeId}"], [id*="-classId-${nodeId}-"]`
      );
      if (nodeEl) {
        handleOpenMemberSection(nodeId, 'attribute', nodeEl);
      }
    },
    [handleOpenMemberSection]
  );

  const handleAddNodeMethod = useCallback(
    (nodeId: string) => {
      const nodeEl = svgMountRef.current?.querySelector(
        `[data-mermaid-node-id="${nodeId}"], [id*="-classId-${nodeId}-"]`
      );
      if (nodeEl) {
        handleOpenMemberSection(nodeId, 'method', nodeEl);
      }
    },
    [handleOpenMemberSection]
  );

  const handleStartEditingNode = useCallback(
    (nodeId: string, nodeEl: Element, event?: MouseEvent | TouchEvent) => {
      if (!isEditable) return;

      const targetEl = (event as MouseEvent)?.target as Element | undefined;

      // 1. Check if user clicked on title area -> rename class / node
      const titleEl = targetEl?.closest('.label-group') || targetEl?.closest('.annotation-group');
      if (titleEl) {
        if (driver.mutations.isNodeTextEditable(astHook.ast, nodeId)) {
          inlineEditing.startEditingNode(nodeId, targetEl?.closest('.label-group') || nodeEl);
        }
        return;
      }

      // 2. Class diagram member compartments (attributes or methods)
      if (driver.capabilities.supportsNodeMembers && driver.mutations.getNodeMembers) {
        const caps = driver.mutations.getNodeMemberCapabilities?.(astHook.ast, nodeId) || {
          supportsAttributes: true,
          supportsMethods: true,
        };

        // Direct hit on members-group or methods-group (or any of their children)
        const hitMembers = targetEl?.closest('.members-group');
        const hitMethods = targetEl?.closest('.methods-group');

        if (hitMembers && caps.supportsAttributes) {
          handleOpenMemberSection(nodeId, 'attribute', nodeEl);
          return;
        }
        if (hitMethods && caps.supportsMethods) {
          handleOpenMemberSection(nodeId, 'method', nodeEl);
          return;
        }

        // Stereotype constraints: interface/service has methods only, enum has values only
        if (!caps.supportsAttributes && caps.supportsMethods) {
          handleOpenMemberSection(nodeId, 'method', nodeEl);
          return;
        }
        if (caps.supportsAttributes && !caps.supportsMethods) {
          handleOpenMemberSection(nodeId, 'attribute', nodeEl);
          return;
        }

        // Both supported: inspect relative click position
        if (event && 'clientY' in event) {
          const rect = nodeEl.getBoundingClientRect();
          const relY = (event.clientY - rect.top) / Math.max(1, rect.height);
          if (relY < 0.35) {
            // Top 35% -> rename class
            if (driver.mutations.isNodeTextEditable(astHook.ast, nodeId)) {
              inlineEditing.startEditingNode(nodeId, nodeEl);
            }
            return;
          } else if (relY < 0.65) {
            // Middle -> attributes
            handleOpenMemberSection(nodeId, 'attribute', nodeEl);
            return;
          } else {
            // Bottom -> methods
            handleOpenMemberSection(nodeId, 'method', nodeEl);
            return;
          }
        }
      }

      // Default fallback: regular node rename
      if (driver.mutations.isNodeTextEditable(astHook.ast, nodeId)) {
        inlineEditing.startEditingNode(nodeId, nodeEl);
      }
    },
    [isEditable, driver, astHook.ast, inlineEditing, handleOpenMemberSection]
  );

  const canRenameSelectedNode = selection.selectedNodeId
    ? driver.mutations.isNodeTextEditable(astHook.ast, selection.selectedNodeId)
    : false;

  const resetTransientUiState = useCallback(() => {
    useCanvasStore.getState().resetTransientUiState();
    selection.updateSelectedNodeHalo(new Set());
    selection.updateSelectedEdgeHalo(new Set());
    if (svgMountRef.current) {
      svgMountRef.current
        .querySelectorAll('.mermaid-cluster-selected, .mermaid-view-highlight')
        .forEach((c) => {
          c.classList.remove('mermaid-cluster-selected');
          c.classList.remove('mermaid-view-highlight');
        });
    }
  }, [selection, svgMountRef]);

  // File switches reuse this component with a new initialCode prop, but
  // useState/useHistory seed once. Without this sync the view keeps showing
  // the old diagram and undo replays the old file's code into the new file.
  const lastInitialCodeRef = useRef<string | null>(null);
  useEffect(() => {
    if (lastInitialCodeRef.current === null) {
      lastInitialCodeRef.current = initialCode;
      return;
    }
    if (initialCode !== lastInitialCodeRef.current) {
      lastInitialCodeRef.current = initialCode;
      const next =
        initialCode || 'flowchart LR\n    A["Start"] --> B["Process"]\n    B --> C["End"]';
      resetHistory(next);
      setCode(next);
      resetTransientUiState();
    }
  }, [initialCode, resetHistory, resetTransientUiState]);

  const handleUndo = useCallback(() => {
    const prevCode = undoHistory();
    if (prevCode === null) return;
    // setCode triggers the re-parse effect inside useDiagramAst
    setCode(prevCode);
    mutations.setSyntaxError(null);
    onCodeChange(prevCode);
    resetTransientUiState();
  }, [undoHistory, onCodeChange, mutations, resetTransientUiState]);

  const handleRedo = useCallback(() => {
    const nextCode = redoHistory();
    if (nextCode === null) return;
    setCode(nextCode);
    mutations.setSyntaxError(null);
    onCodeChange(nextCode);
    resetTransientUiState();
  }, [redoHistory, onCodeChange, mutations, resetTransientUiState]);

  const handleSelectAll = useCallback(() => {
    if (!isEditable) {
      if (svgMountRef.current) {
        const selectables = svgMountRef.current.querySelectorAll(
          '.node, .actor, .task, .section, .cluster, g[id]:not(#defs):not(.grid):not([id*="arrowhead"]), .label'
        );
        selectables.forEach((el) => el.classList.add('mermaid-view-highlight'));
      }
      return;
    }
    const anchors = driver.mutations.anchors;
    const allNodeIds = new Set(
      Array.from(mutations.displayNodes.keys()).filter(
        (id) => !(anchors && anchors.isAnchor(id))
      )
    );
    const allEdgeIds = new Set(mutations.displayEdges.map((e) => e.id));
    useCanvasStore.getState().setSelectedStarKind(null);
    selection.selectedNodeIdsRef.current = allNodeIds;
    selection.selectedEdgeIdsRef.current = allEdgeIds;
    selection.setSelectedNodeIds(allNodeIds);
    selection.setSelectedEdgeIds(allEdgeIds);
    selection.setSelectedSubgraphId(null);
    selection.setSelectedNodeRect(null);
    selection.setSelectedEdgePos(null);
    selection.setSelectedSubgraphRect(null);
    selection.setActiveSubgraphPopover(null);
    selection.updateSelectedNodeHalo(allNodeIds);
    selection.updateSelectedEdgeHalo(allEdgeIds);
  }, [isEditable, driver, mutations.displayNodes, mutations.displayEdges, selection]);

  // 8. Keyboard Shortcuts
  const hasActivePopovers = !!(
    selection.activeNodePopover ||
    selection.activeEdgePopover ||
    selection.activeMultiPopover ||
    selection.activeSubgraphPopover
  );
  const hasSelectedElements =
    selection.selectedNodeIds.size > 0 ||
    selection.selectedEdgeIds.size > 0 ||
    !!selection.selectedSubgraphId;

  const { isSpacePressed } = useCanvasShortcuts({
    isEditable,
    setCursorMode,
    handleUndo,
    handleRedo,
    handleSelectAll,
    handleDuplicateSelected: mutations.handleDuplicateSelected,
    handleCopySelected: mutations.handleCopySelected,
    handlePasteSelected: mutations.handlePasteSelected,
    handleBatchDeleteSelected: mutations.handleBatchDeleteSelected,
    clearSelection: () => {
      selection.clearSelection();
      if (svgMountRef.current) {
        svgMountRef.current
          .querySelectorAll('.mermaid-view-highlight')
          .forEach((el) => el.classList.remove('mermaid-view-highlight'));
      }
    },
    hasActivePopovers,
    clearActivePopovers: () => {
      selection.setActiveNodePopover(null);
      selection.setActiveEdgePopover(null);
      selection.setActiveMultiPopover(null);
      selection.setActiveSubgraphPopover(null);
    },
    hasSelectedElements,
    canCopy: selection.selectedNodeIds.size > 0,
    handleFitView,
    onToggleFullscreen: handleToggleFullscreen,
  });

  // 9. Mouse Interactions (Panning, Connecting, Hover)
  const mouse = useCanvasMouseInteractions({
    worldRef,
    svgMountRef,
    getLocalRect,
    zoom,
    cursorMode,
    isSpacePressed,
    isPanning,
    startPan,
    updatePan,
    endPan,
    marquee,
    displayNodes: mutations.displayNodes,
    displayEdges: mutations.displayEdges,
    displaySubgraphs: mutations.displaySubgraphs,
    driver,
    ast: mutations.ast,
    applyMutation: mutations.applyMutation,
    setSelectedNodeId: selection.setSelectedNodeId,
  });

  // 10. Mermaid Native SVG Mount & Renderer
  useCanvasRenderer({
    app,
    code,
    driver,
    svgMountRef,
    displayNodes: mutations.displayNodes,
    displayEdges: mutations.displayEdges,
    displaySubgraphs: mutations.displaySubgraphs,
    getLocalRect,
    getLocalPoint,
    updateSelectedNodeHalo: selection.updateSelectedNodeHalo,
    updateSelectedEdgeHalo: selection.updateSelectedEdgeHalo,
    updateSelectedNodeRect: selection.updateSelectedNodeRect,
    inlineEditing,
    handleStartEditingNode,
    stabilizeCamera,
    setSyntaxError: mutations.setSyntaxError,
    onInitialRender: handleFitView,
  });

  // 11. Drop-target highlight while drag-connecting (red when the driver refuses)
  const connectingSourceId = useCanvasStore((s) => s.connectingSourceId);
  const connectingTargetId = useCanvasStore((s) => s.connectingTargetId);
  const connectBlocked = useCanvasStore((s) => s.connectBlocked);
  useEffect(() => {
    applyDropTargetHalo(
      svgMountRef.current,
      connectingTargetId,
      connectingSourceId,
      connectBlocked
    );
    if (!connectingSourceId && !connectingTargetId && svgMountRef.current) {
      // Ensure stale drop-target classes are cleared when drag ends.
      svgMountRef.current
        .querySelectorAll('.mermaid-drop-target-halo')
        .forEach((el) => el.remove());
      svgMountRef.current.querySelectorAll('.mermaid-drop-target').forEach((el) => {
        el.classList.remove('mermaid-drop-target');
      });
      svgMountRef.current.querySelectorAll('.mermaid-drop-blocked').forEach((el) => {
        el.classList.remove('mermaid-drop-blocked');
      });
    }
  }, [connectingSourceId, connectingTargetId, connectBlocked, svgMountRef, code]);

  // 12. Theme switch synchronization (Obsidian css-change event)
  useEffect(() => {
    const onCssChange = () => {
      selection.updateSelectedNodeHalo(selection.selectedNodeIdsRef.current);
      selection.updateSelectedEdgeHalo(selection.selectedEdgeIdsRef.current);
      selection.updateSelectedNodeRect();
    };
    const ref = app.workspace.on('css-change', onCssChange);
    return () => {
      app.workspace.offref(ref);
    };
  }, [app, selection]);

  return (
    <div
      className={`mermaid-native-editor-root is-mode-${cursorMode} ${
        isPanning ? 'is-panning' : ''
      } ${isSpacePressed ? 'is-space-held' : ''} ${!isEditable ? 'is-view-only' : ''} ${
        mouse.connectingSourceId ? 'is-connecting' : ''
      } ${connectBlocked ? 'is-drop-blocked' : ''}`}
      ref={containerRef}
      onWheel={handleWheel}
      onPointerDown={(e) => {
        activePointersRef.current.set(e.pointerId, {
          x: e.clientX,
          y: e.clientY,
        });
        if (activePointersRef.current.size === 2) {
          // Second finger lands: abort the single-pointer gesture and pinch.
          mouse.handlePointerCancel();
          const s = pinchStats(activePointersRef.current);
          startPinch(s.dist, s.midX, s.midY);
          return;
        }
        mouse.handlePointerDown(e);
      }}
      onPointerMove={(e) => {
        if (activePointersRef.current.has(e.pointerId)) {
          activePointersRef.current.set(e.pointerId, {
            x: e.clientX,
            y: e.clientY,
          });
        }
        if (activePointersRef.current.size >= 2) {
          const s = pinchStats(activePointersRef.current);
          updatePinch(s.dist, s.midX, s.midY);
          return;
        }
        // Lazy pointer capture: capture finger drags only once movement exceeds
        // the click threshold so that taps pass through as native clicks to shapes.
        // Mouse pointers do not use pointer capture so native clicks and hit-testing pass through.
        if (
          e.pointerType !== 'mouse' &&
          !e.currentTarget.hasPointerCapture?.(e.pointerId)
        ) {
          const start = activePointersRef.current.get(e.pointerId);
          if (
            start &&
            Math.hypot(e.clientX - start.x, e.clientY - start.y) > 4
          ) {
            try {
              e.currentTarget.setPointerCapture?.(e.pointerId);
            } catch {
              /* ignore */
            }
          }
        }
        mouse.handlePointerMove(e);
      }}
      onPointerUp={(e) => {
        activePointersRef.current.delete(e.pointerId);
        try {
          if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
            e.currentTarget.releasePointerCapture?.(e.pointerId);
          }
        } catch {
          /* ignore */
        }
        if (pinchRef.current) {
          // Pinch just ended: the released finger's gesture was already
          // cancelled at pinch start, so there is nothing to commit.
          if (activePointersRef.current.size === 0) endPinch();
          return;
        }
        mouse.handlePointerUp(e);
      }}
      onPointerCancel={(e) => {
        activePointersRef.current.delete(e.pointerId);
        try {
          if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
            e.currentTarget.releasePointerCapture?.(e.pointerId);
          }
        } catch {
          /* ignore */
        }
        endPinch();
        mouse.handlePointerCancel();
      }}
      onPointerLeave={() => {
        if (!mouse.connectingSourceId) {
          useCanvasStore.getState().setHoveredNode(null, null, null);
        } else {
          useCanvasStore.getState().setConnectingTargetId(null);
        }
      }}
      onDoubleClick={(e) => {
        if (
          e.target === containerRef.current ||
          e.target === worldRef.current ||
          (e.target as HTMLElement).classList?.contains('mermaid-native-world') ||
          (e.target as Element).tagName === 'svg'
        ) {
          handleFitView();
        }
      }}
      onClick={(e) => {
        if (marquee.isMarqueeActiveRef.current) return;
        const target = e.target as HTMLElement | SVGElement | null;
        if (
          target &&
          target.closest?.(
            '[data-mermaid-node-id], [data-mermaid-edge-id], [data-mermaid-subgraph-id], .nodrag, .mermaid-tool-btn, .mermaid-popover'
          )
        ) {
          return;
        }
        resetTransientUiState();
      }}
    >
      {/* Top Controls Bar */}
      <CanvasTopBar
        driver={driver}
        cursorMode={cursorMode}
        onSetCursorMode={setCursorMode}
        onAddStep={mutations.handleAddStandaloneStep}
        onAddStart={mutations.handleAddStartState}
        onAddEnd={mutations.handleAddEndState}
        canAddStart={!mutations.hasStartState}
        canAddEnd={!mutations.hasEndState}
        onAddGroup={mutations.handleAddGroup}
        direction={mutations.displayDirection}
        onToggleDirection={mutations.handleToggleDirection}
        onFitView={handleFitView}
        showCodeDrawer={showCodeDrawer}
        onToggleCodeDrawer={() => setShowCodeDrawer(!showCodeDrawer)}
        canUndo={history.canUndo}
        canRedo={history.canRedo}
        onUndo={handleUndo}
        onRedo={handleRedo}
        isFullscreen={isFullscreen}
        onToggleFullscreen={handleToggleFullscreen}
        svgMountRef={svgMountRef}
        app={app}
        code={code}
        theme={mutations.currentTheme}
        onSetTheme={mutations.handleSetTheme}
      />

      {/* Interactive World Canvas */}
      <div
        className="mermaid-native-world"
        ref={worldRef}
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0',
        }}
      >
        {/* Native Mermaid SVG Output */}
        {/* Fixed id is a pure CSS hook: `#merlay-svg-mount`-scoped rules
            outrank Mermaid's `#<render-id>`-scoped theme without !important.
            It may repeat across diagram views; nothing queries it by id. */}
        <div className="mermaid-native-svg-mount mermaid" id="merlay-svg-mount" ref={svgMountRef} />

        {/* Interactive Overlay Layer (full editing overlays for editable diagrams, marquee only for view-only) */}
        {isEditable ? (
          <CanvasOverlays
            mouse={mouse}
            marquee={marquee}
            selection={selection}
            mutations={mutations}
            inlineEditing={inlineEditing}
            cursorMode={cursorMode}
            isSpacePressed={isSpacePressed}
            canRenameSelectedNode={canRenameSelectedNode}
            svgMountRef={svgMountRef}
            handleStartEditingNode={handleStartEditingNode}
            onAddNodeAttribute={handleAddNodeAttribute}
            onAddNodeMethod={handleAddNodeMethod}
          />
        ) : (
          <div className="mermaid-native-overlay">
            <SelectionMarquee box={marquee.selectionBox} />
          </div>
        )}
      </div>

      {/* Diagram Affordance Guide (polymorphic per driver) */}
      {isEditable && driver.canvasHint && (
        <div className="mermaid-canvas-hint-bar nodrag">
          <span>
            💡 <strong>Tip:</strong>{' '}
            {isCoarsePointer ? driver.canvasHint.touch : driver.canvasHint.desktop}
          </span>
        </div>
      )}

      {/* Unsupported Diagram View-Only Banner */}
      {!isEditable && (
        <div className="mermaid-canvas-hint-bar mermaid-view-only-banner nodrag">
          <span>ℹ️ Editing <strong>{driver.displayName}</strong> diagrams is not yet supported &bull; View mode only (pan, zoom, and highlight available)</span>
        </div>
      )}

      {/* Slide-out Mermaid Code Syntax Drawer */}
      <SyntaxDrawer
        isOpen={showCodeDrawer}
        code={code}
        syntaxError={mutations.syntaxError}
        readOnly={!isEditable}
        onClose={() => setShowCodeDrawer(false)}
        onChangeCode={(newCode) => {
          if (!isEditable) return;
          setCode(newCode);
          onCodeChange(newCode);
        }}
      />
    </div>
  );
};
