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
import {
  ActiveEdgePopover,
  ActiveMultiPopover,
  ActiveNodePopover,
  CursorMode,
  Rect,
  SelectedEdgePos,
} from '../types';

export interface DragLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface CanvasStoreState {
  // Selection
  selectedNodeIds: Set<string>;
  selectedEdgeIds: Set<string>;
  selectedSubgraphId: string | null;
  selectedStarKind: 'start' | 'end' | null;

  // Bounding Geometry
  selectedNodeRect: Rect | null;
  selectedEdgePos: SelectedEdgePos | null;
  selectedSubgraphRect: Rect | null;

  // Active Popovers
  activeNodePopover: ActiveNodePopover;
  activeEdgePopover: ActiveEdgePopover;
  activeMultiPopover: ActiveMultiPopover;
  activeSubgraphPopover: 'style' | 'group' | null;
  unmatchedSubgraphIds: string[];

  // Mouse & Hover & Connecting
  cursorMode: CursorMode;
  hoveredNodeId: string | null;
  hoveredNodeRect: Rect | null;
  hoveredNodeKind: 'start' | 'end' | null;
  connectingSourceId: string | null;
  connectingSourceKind: 'start' | 'end' | null;
  connectingHandleKind: 'start' | 'end' | null;
  connectingTargetId: string | null;
  dragLine: DragLine | null;
  /** True while the pending drop target would refuse the connection (driver canConnect). */
  connectBlocked: boolean;

  // Camera & Viewport
  zoom: number;
  pan: { x: number; y: number };
  isPanning: boolean;
  showCodeDrawer: boolean;

  // Inline Text Editing
  editingNodeId: string | null;
  editingNodeRect: Rect | null;
  editingNodeLabel: string;
  editingEdgeId: string | null;
  editingEdgePos: { x: number; y: number } | null;
  editingEdgeLabel: string;
  editingSubgraphId: string | null;
  editingSubgraphRect: Rect | null;
  editingSubgraphLabel: string;

  // Actions
  setSelectedNodeIds: (ids: Set<string>) => void;
  setSelectedEdgeIds: (ids: Set<string>) => void;
  setSelectedSubgraphId: (id: string | null) => void;
  setSelectedStarKind: (kind: 'start' | 'end' | null) => void;
  setSelectedNodeRect: (rect: Rect | null) => void;
  setSelectedEdgePos: (pos: SelectedEdgePos | null) => void;
  setSelectedSubgraphRect: (rect: Rect | null) => void;

  setActiveNodePopover: (
    popover: ActiveNodePopover | ((prev: ActiveNodePopover) => ActiveNodePopover)
  ) => void;
  setActiveEdgePopover: (
    popover: ActiveEdgePopover | ((prev: ActiveEdgePopover) => ActiveEdgePopover)
  ) => void;
  setActiveMultiPopover: (
    popover: ActiveMultiPopover | ((prev: ActiveMultiPopover) => ActiveMultiPopover)
  ) => void;
  setActiveSubgraphPopover: (
    popover:
      | 'style'
      | 'group'
      | null
      | ((prev: 'style' | 'group' | null) => 'style' | 'group' | null)
  ) => void;
  setUnmatchedSubgraphIds: (
    ids: string[] | ((prev: string[]) => string[])
  ) => void;

  setCursorMode: (mode: CursorMode) => void;
  setHoveredNode: (
    id: string | null,
    rect: Rect | null,
    kind?: 'start' | 'end' | null
  ) => void;
  setConnecting: (
    sourceId: string | null,
    sourceKind?: 'start' | 'end' | null,
    dragLine?: DragLine | null
  ) => void;
  setDragLine: (
    dragLine:
      | DragLine
      | null
      | ((prev: DragLine | null) => DragLine | null)
  ) => void;
  setConnectingSourceId: (id: string | null) => void;
  setConnectingSourceKind: (kind: 'start' | 'end' | null) => void;
  setConnectingHandleKind: (kind: 'start' | 'end' | null) => void;
  setConnectingTargetId: (id: string | null) => void;
  setConnectBlocked: (blocked: boolean) => void;

  setCamera: (updates: {
    pan?: { x: number; y: number };
    zoom?: number;
    isPanning?: boolean;
  }) => void;
  setShowCodeDrawer: (show: boolean | ((prev: boolean) => boolean)) => void;

  setEditingNode: (id: string | null, rect?: Rect | null, label?: string) => void;
  setEditingEdge: (
    id: string | null,
    pos?: { x: number; y: number } | null,
    label?: string
  ) => void;
  setEditingSubgraph: (
    id: string | null,
    rect?: Rect | null,
    label?: string
  ) => void;
  clearEditing: () => void;

  clearSelection: () => void;
  clearPopovers: () => void;
  resetTransientUiState: () => void;
}

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
