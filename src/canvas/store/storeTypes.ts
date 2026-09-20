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
