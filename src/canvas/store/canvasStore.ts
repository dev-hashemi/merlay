/**
 * Centralized Canvas Zustand Store
 *
 * Decouples canvas state (selection, geometry, popovers, camera, hover/connecting,
 * inline text editing) from React component prop-drilling.
 *
 * Eliminates ref-mirroring hacks (e.g. selectedNodeIdsRef, selectedStarKindRef)
 * by enabling direct synchronous reads via `useCanvasStore.getState()` from
 * any DOM listener, callback, or hook.
 */

import { create } from 'zustand';
import { CanvasStoreState } from './storeTypes';

export * from './storeTypes';

export const useCanvasStore = create<CanvasStoreState>((set) => ({
  // Initial Selection
  selectedNodeIds: new Set<string>(),
  selectedEdgeIds: new Set<string>(),
  selectedSubgraphId: null,
  selectedStarKind: null,

  // Initial Geometry
  selectedNodeRect: null,
  selectedEdgePos: null,
  selectedSubgraphRect: null,

  // Initial Popovers
  activeNodePopover: null,
  activeEdgePopover: null,
  activeMultiPopover: null,
  activeSubgraphPopover: null,
  unmatchedSubgraphIds: [],

  // Initial Mouse & Hover & Connecting
  cursorMode: 'select',
  hoveredNodeId: null,
  hoveredNodeRect: null,
  hoveredNodeKind: null,
  connectingSourceId: null,
  connectingSourceKind: null,
  connectingHandleKind: null,
  connectingTargetId: null,
  dragLine: null,
  connectBlocked: false,

  // Initial Camera
  zoom: 1,
  pan: { x: 0, y: 0 },
  isPanning: false,
  showCodeDrawer: false,

  // Initial Inline Editing
  editingNodeId: null,
  editingNodeRect: null,
  editingNodeLabel: '',
  editingEdgeId: null,
  editingEdgePos: null,
  editingEdgeLabel: '',
  editingSubgraphId: null,
  editingSubgraphRect: null,
  editingSubgraphLabel: '',

  // Actions
  setSelectedNodeIds: (ids) => set({ selectedNodeIds: ids }),
  setSelectedEdgeIds: (ids) => set({ selectedEdgeIds: ids }),
  setSelectedSubgraphId: (id) => set({ selectedSubgraphId: id }),
  setSelectedStarKind: (kind) => set({ selectedStarKind: kind }),
  setSelectedNodeRect: (rect) => set({ selectedNodeRect: rect }),
  setSelectedEdgePos: (pos) => set({ selectedEdgePos: pos }),
  setSelectedSubgraphRect: (rect) => set({ selectedSubgraphRect: rect }),

  setActiveNodePopover: (popover) =>
    set((state) => ({
      activeNodePopover:
        typeof popover === 'function' ? popover(state.activeNodePopover) : popover,
    })),
  setActiveEdgePopover: (popover) =>
    set((state) => ({
      activeEdgePopover:
        typeof popover === 'function' ? popover(state.activeEdgePopover) : popover,
    })),
  setActiveMultiPopover: (popover) =>
    set((state) => ({
      activeMultiPopover:
        typeof popover === 'function' ? popover(state.activeMultiPopover) : popover,
    })),
  setActiveSubgraphPopover: (popover) =>
    set((state) => ({
      activeSubgraphPopover:
        typeof popover === 'function' ? popover(state.activeSubgraphPopover) : popover,
    })),
  setUnmatchedSubgraphIds: (ids) =>
    set((state) => ({
      unmatchedSubgraphIds:
        typeof ids === 'function' ? ids(state.unmatchedSubgraphIds) : ids,
    })),

  setCursorMode: (mode) => set({ cursorMode: mode }),
  setHoveredNode: (id, rect = null, kind = null) =>
    set({
      hoveredNodeId: id,
      hoveredNodeRect: rect,
      hoveredNodeKind: kind,
    }),
  setConnecting: (sourceId, sourceKind = null, dragLine = null) =>
    set({
      connectingSourceId: sourceId,
      connectingSourceKind: sourceKind,
      connectingHandleKind: sourceKind,
      connectingTargetId: null,
      connectBlocked: false,
      dragLine,
    }),
  setDragLine: (dragLine) =>
    set((state) => ({
      dragLine:
        typeof dragLine === 'function' ? dragLine(state.dragLine) : dragLine,
    })),
  setConnectingSourceId: (id) => set({ connectingSourceId: id }),
  setConnectingSourceKind: (kind) =>
    set({ connectingSourceKind: kind, connectingHandleKind: kind }),
  setConnectingHandleKind: (kind) =>
    set({ connectingSourceKind: kind, connectingHandleKind: kind }),
  setConnectingTargetId: (id) => set({ connectingTargetId: id }),
  setConnectBlocked: (blocked) => set({ connectBlocked: blocked }),

  setCamera: (updates) =>
    set((state) => ({
      pan: updates.pan !== undefined ? updates.pan : state.pan,
      zoom: updates.zoom !== undefined ? updates.zoom : state.zoom,
      isPanning: updates.isPanning !== undefined ? updates.isPanning : state.isPanning,
    })),
  setShowCodeDrawer: (show) =>
    set((state) => ({
      showCodeDrawer: typeof show === 'function' ? show(state.showCodeDrawer) : show,
    })),

  setEditingNode: (id, rect = null, label = '') =>
    set({
      editingNodeId: id,
      editingNodeRect: rect,
      editingNodeLabel: label,
    }),
  setEditingEdge: (id, pos = null, label = '') =>
    set({
      editingEdgeId: id,
      editingEdgePos: pos,
      editingEdgeLabel: label,
    }),
  setEditingSubgraph: (id, rect = null, label = '') =>
    set({
      editingSubgraphId: id,
      editingSubgraphRect: rect,
      editingSubgraphLabel: label,
    }),
  clearEditing: () =>
    set({
      editingNodeId: null,
      editingNodeRect: null,
      editingNodeLabel: '',
      editingEdgeId: null,
      editingEdgePos: null,
      editingEdgeLabel: '',
      editingSubgraphId: null,
      editingSubgraphRect: null,
      editingSubgraphLabel: '',
    }),

  clearSelection: () =>
    set({
      selectedNodeIds: new Set(),
      selectedEdgeIds: new Set(),
      selectedSubgraphId: null,
      selectedStarKind: null,
      selectedNodeRect: null,
      selectedEdgePos: null,
      selectedSubgraphRect: null,
      activeNodePopover: null,
      activeEdgePopover: null,
      activeMultiPopover: null,
      activeSubgraphPopover: null,
    }),

  clearPopovers: () =>
    set({
      activeNodePopover: null,
      activeEdgePopover: null,
      activeMultiPopover: null,
      activeSubgraphPopover: null,
    }),

  resetTransientUiState: () =>
    set({
      selectedNodeIds: new Set(),
      selectedEdgeIds: new Set(),
      selectedSubgraphId: null,
      selectedStarKind: null,
      selectedNodeRect: null,
      selectedEdgePos: null,
      selectedSubgraphRect: null,
      activeNodePopover: null,
      activeEdgePopover: null,
      activeMultiPopover: null,
      activeSubgraphPopover: null,
      editingNodeId: null,
      editingNodeRect: null,
      editingNodeLabel: '',
      editingEdgeId: null,
      editingEdgePos: null,
      editingEdgeLabel: '',
      editingSubgraphId: null,
      editingSubgraphRect: null,
      editingSubgraphLabel: '',
      hoveredNodeId: null,
      hoveredNodeRect: null,
      hoveredNodeKind: null,
      connectingSourceId: null,
      connectingSourceKind: null,
      connectingHandleKind: null,
      connectingTargetId: null,
      dragLine: null,
      connectBlocked: false,
    }),
}));
