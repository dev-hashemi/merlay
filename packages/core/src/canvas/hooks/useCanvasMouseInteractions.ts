/**
 * Hook for canvas pointer interactions: panning, connection dragging, node hover proximity, and marquee triggering.
 * Uses Pointer Events so mouse, touch, and pen share one code path (fixes finger-drag on touchscreens).
 */

import React, { useCallback, useRef } from 'react';
import { CursorMode, Rect } from '../types';
import { DiagramDriver } from '../../diagrams/types';
import { MermaidNodeDef, MermaidEdgeDef, MermaidSubgraphDef } from '../../diagrams/viewModel';
import { DragLine, useCanvasStore } from '../store/canvasStore';
import { getPerimeterAnchor, getHitElement } from './mouse/mouseGeometry';
import {
  findClosestNodeElement,
  isBlockedAnchorEdge,
  isInnerToOuterBlocked,
  resolveSequenceInsertion,
} from './mouse/connectionDropTarget';

export { getPerimeterAnchor };

export interface UseCanvasMouseInteractionsOptions {
  worldRef: React.RefObject<HTMLDivElement>;
  svgMountRef?: React.RefObject<HTMLDivElement>;
  getLocalRect?: (el: Element) => Rect | null;
  zoom: number;
  cursorMode: CursorMode;
  isSpacePressed: boolean;
  isPanning: boolean;
  startPan: (clientX: number, clientY: number) => void;
  updatePan: (clientX: number, clientY: number) => void;
  endPan: () => void;
  marquee: {
    startMarquee: (clientX: number, clientY: number) => void;
    updateMarquee: (
      clientX: number,
      clientY: number,
      displayNodes: Map<string, MermaidNodeDef>,
      displayEdges: MermaidEdgeDef[]
    ) => boolean;
    endMarquee: (
      displayNodes: Map<string, MermaidNodeDef>,
      displayEdges: MermaidEdgeDef[]
    ) => void;
    dragBoxStartRef: React.MutableRefObject<{ x: number; y: number } | null>;
  };
  displayNodes: Map<string, MermaidNodeDef>;
  displayEdges: MermaidEdgeDef[];
  displaySubgraphs?: Map<string, MermaidSubgraphDef>;
  driver: DiagramDriver;
  /** Committed AST, for driver legality predicates (e.g. canConnect). Read-only. */
  ast: unknown;
  applyMutation: (mutator: (currentAst: unknown) => void, keepNodeId?: string) => void;
  setSelectedNodeId: (id: string | null) => void;
}

export function useCanvasMouseInteractions({
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
  displayNodes,
  displayEdges,
  displaySubgraphs,
  driver,
  ast,
  applyMutation,
  setSelectedNodeId,
}: UseCanvasMouseInteractionsOptions) {
  const m = driver.mutations;
  const anchors = m.anchors;

  const connectingSourceId = useCanvasStore((s) => s.connectingSourceId);
  const connectingSourceKind = useCanvasStore(
    (s) => s.connectingSourceKind ?? s.connectingHandleKind
  );
  const connectingTargetId = useCanvasStore((s) => s.connectingTargetId);
  const connectBlocked = useCanvasStore((s) => s.connectBlocked);
  const dragLine = useCanvasStore((s) => s.dragLine);

  const hoveredNodeId = useCanvasStore((s) => s.hoveredNodeId);
  const hoveredNodeRect = useCanvasStore((s) => s.hoveredNodeRect);
  const hoveredNodeKind = useCanvasStore((s) => s.hoveredNodeKind);

  const setConnectingSourceId = useCallback((id: string | null) => {
    useCanvasStore.getState().setConnectingSourceId(id);
  }, []);

  const setConnectingSourceKind = useCallback((kind: 'start' | 'end' | null) => {
    useCanvasStore.getState().setConnectingSourceKind(kind);
  }, []);

  const setDragLine = useCallback(
    (
      line:
        | DragLine
        | null
        | ((prev: DragLine | null) => DragLine | null)
    ) => {
      useCanvasStore.getState().setDragLine(line);
    },
    []
  );

  const setHoveredNode = useCallback(
    (id: string | null, rect: Rect | null, kind?: 'start' | 'end' | null) => {
      useCanvasStore.getState().setHoveredNode(id, rect, kind);
    },
    []
  );

  const setHoveredNodeId = useCallback((id: string | null) => {
    const s = useCanvasStore.getState();
    s.setHoveredNode(id, s.hoveredNodeRect, s.hoveredNodeKind);
  }, []);

  const setHoveredNodeRect = useCallback((rect: Rect | null) => {
    const s = useCanvasStore.getState();
    s.setHoveredNode(s.hoveredNodeId, rect, s.hoveredNodeKind);
  }, []);

  const setHoveredNodeKind = useCallback((kind: 'start' | 'end' | null) => {
    const s = useCanvasStore.getState();
    s.setHoveredNode(s.hoveredNodeId, s.hoveredNodeRect, kind);
  }, []);

  const isAnchorId = (id: string | null | undefined): boolean =>
    !!anchors && !!id && anchors.isAnchor(id);

  const pendingConnectRef = useRef<{
    sourceId: string;
    sourceKind: 'start' | 'end' | null;
    startClientX: number;
    startClientY: number;
    sourceEl: Element;
    sourceRect: Rect | null;
    isLifeline: boolean;
  } | null>(null);

  const DRAG_THRESHOLD = 6; // px movement deadband to protect clicks & double-clicks
  /** Hold-still delay before an empty-canvas touch becomes a marquee (otherwise it pans). */
  const EMPTY_HOLD_FOR_MARQUEE_MS = 400;
  /** Movement that commits an undecided empty-canvas touch to panning. */
  const EMPTY_PAN_TOLERANCE_PX = 10;

  /**
   * Undecided empty-canvas touch: finger is down but hasn't moved yet.
   * Hold still → marquee selection; move → pan (mobile best practice).
   */
  const touchEmptyRef = useRef<{
    startClientX: number;
    startClientY: number;
    timer: number | null;
    marqueeArmed: boolean;
  } | null>(null);

  const clearTouchEmpty = (): void => {
    if (touchEmptyRef.current?.timer) window.clearTimeout(touchEmptyRef.current.timer);
    touchEmptyRef.current = null;
  };

  const handleStartConnect = (
    e: React.PointerEvent,
    startX: number,
    startY: number
  ) => {
    e.stopPropagation();
    e.preventDefault();
    const store = useCanvasStore.getState();
    const curHoveredId = store.hoveredNodeId;
    const curHoveredKind = store.hoveredNodeKind;
    if (!curHoveredId) return;
    // End anchors have no outgoing transitions.
    if (isAnchorId(curHoveredId) && curHoveredKind === 'end') return;

    store.setConnecting(curHoveredId, curHoveredKind, {
      x1: startX,
      y1: startY,
      x2: startX,
      y2: startY,
    });
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    // Multi-touch second fingers belong to pinch-zoom (camera layer), never to connect/marquee.
    if (e.isPrimary === false) return;
    if (
      (e.target as HTMLElement).closest('.nodrag') ||
      (e.target as HTMLElement).closest('.mermaid-action-hud') ||
      (e.target as HTMLElement).closest('.mermaid-multiselect-hud') ||
      (e.target as HTMLElement).closest('.mermaid-edge-hud')
    ) {
      return;
    }

    const isMouse = e.pointerType === 'mouse';
    const isMiddleClick = isMouse && e.button === 1;
    const isHandModeActive =
      cursorMode === 'hand' ||
      isSpacePressed ||
      isMiddleClick;

    if (isHandModeActive) {
      startPan(e.clientX, e.clientY);
      return;
    }

    if (isMouse && e.button !== 0) return;

    // Check if clicking on an interactive node, anchor, lifeline, or cluster
    const nodeEl = (e.target as HTMLElement).closest('[data-mermaid-node-id]');
    const sourceNodeId = nodeEl?.getAttribute('data-mermaid-node-id');
    const sourceKind =
      (nodeEl?.getAttribute('data-mermaid-start-end') as 'start' | 'end' | null) ?? null;

    // End anchors in state diagrams cannot have outgoing transitions
    const isEndAnchor = isAnchorId(sourceNodeId) && sourceKind === 'end';

    if (nodeEl && sourceNodeId && !isEndAnchor) {
      const isLifeline =
        nodeEl.classList.contains('mermaid-lifeline-hit-area') ||
        nodeEl.classList.contains('actor-line');

      const sourceRect = getLocalRect ? getLocalRect(nodeEl) : null;

      pendingConnectRef.current = {
        sourceId: sourceNodeId,
        sourceKind,
        startClientX: e.clientX,
        startClientY: e.clientY,
        sourceEl: nodeEl,
        sourceRect,
        isLifeline,
      };
      // Touch has no hover: seed the hovered-node store so the drag can start
      // and the connection hint pill has geometry to render from.
      if (e.pointerType !== 'mouse') {
        useCanvasStore.getState().setHoveredNode(sourceNodeId, sourceRect, sourceKind);
      }
      // Do not start marquee when clicking on a node!
      return;
    }

    // Empty canvas press starts marquee selection on mouse. On touch, a
    // one-finger drag pans (mobile best practice) — marquee needs a hold first.
    if (e.pointerType !== 'mouse' && !isHandModeActive) {
      touchEmptyRef.current = {
        startClientX: e.clientX,
        startClientY: e.clientY,
        timer: null,
        marqueeArmed: false,
      };
      touchEmptyRef.current.timer = window.setTimeout(() => {
        const t = touchEmptyRef.current;
        if (!t) return;
        t.timer = null;
        t.marqueeArmed = true;
        marquee.startMarquee(t.startClientX, t.startClientY);
      }, EMPTY_HOLD_FOR_MARQUEE_MS);
      return;
    }
    marquee.startMarquee(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (e.isPrimary === false) return;
    if (isPanning) {
      updatePan(e.clientX, e.clientY);
      return;
    }

    // Resolve an undecided empty-canvas touch: move wins → pan, hold won → marquee.
    if (touchEmptyRef.current) {
      const t = touchEmptyRef.current;
      if (!t.marqueeArmed) {
        const dist = Math.hypot(
          e.clientX - t.startClientX,
          e.clientY - t.startClientY
        );
        if (dist > EMPTY_PAN_TOLERANCE_PX) {
          clearTouchEmpty();
          // Anchor the pan at the gesture origin so the canvas doesn't jump.
          startPan(t.startClientX, t.startClientY);
          updatePan(e.clientX, e.clientY);
        }
        return;
      }
      marquee.updateMarquee(e.clientX, e.clientY, displayNodes, displayEdges);
      return;
    }

    // Check if pending shape drag has exceeded the movement threshold
    if (pendingConnectRef.current && worldRef.current) {
      const dx = e.clientX - pendingConnectRef.current.startClientX;
      const dy = e.clientY - pendingConnectRef.current.startClientY;
      const dist = Math.hypot(dx, dy);

      if (dist >= DRAG_THRESHOLD) {
        const { sourceId, sourceKind, sourceRect, isLifeline, startClientY, sourceEl } =
          pendingConnectRef.current;
        pendingConnectRef.current = null;

        const worldRect = worldRef.current.getBoundingClientRect();
        const currentWorldX = (e.clientX - worldRect.left) / zoom;
        const currentWorldY = (e.clientY - worldRect.top) / zoom;

        const resolvedRect =
          sourceRect || (getLocalRect ? getLocalRect(sourceEl) : null);

        let startPoint: { x: number; y: number };

        if (isLifeline && resolvedRect) {
          const startWorldY = (startClientY - worldRect.top) / zoom;
          startPoint = {
            x: resolvedRect.x + resolvedRect.width / 2,
            y: Math.max(
              resolvedRect.y,
              Math.min(resolvedRect.y + resolvedRect.height, startWorldY)
            ),
          };
        } else if (resolvedRect) {
          startPoint = getPerimeterAnchor(resolvedRect, currentWorldX, currentWorldY);
        } else {
          startPoint = { x: currentWorldX, y: currentWorldY };
        }

        // Highlight/select the source node as drag begins
        setSelectedNodeId(sourceId);

        useCanvasStore.getState().setConnecting(sourceId, sourceKind, {
          x1: startPoint.x,
          y1: startPoint.y,
          x2: currentWorldX,
          y2: currentWorldY,
        });
        return;
      }
      // Below threshold: hold off to let click / double-click pass cleanly
      return;
    }

    const store = useCanvasStore.getState();
    if (store.connectingSourceId && worldRef.current) {
      const worldRect = worldRef.current.getBoundingClientRect();
      const currentWorldX = (e.clientX - worldRect.left) / zoom;
      const currentWorldY = (e.clientY - worldRect.top) / zoom;
      const sourceId = store.connectingSourceId;

      // Track the pending drop target so the canvas can highlight the
      // participant that will receive the connection.
      const hitEl = getHitElement(e);
      const rawTarget = hitEl?.closest?.('[data-mermaid-node-id]');
      const rawTargetId =
        rawTarget?.getAttribute('data-mermaid-node-id') ||
        rawTarget?.getAttribute('name') ||
        rawTarget?.getAttribute('data-id') ||
        null;

      // If hovering directly over a real node (not a subgraph), target that node.
      // If hovering over a subgraph or empty space, snap to closest real node within 50px.
      let resolvedTargetId: string | null = null;
      if (rawTargetId && displayNodes?.has(rawTargetId)) {
        resolvedTargetId = rawTargetId !== sourceId ? rawTargetId : null;
      } else if (worldRef.current) {
        const snap = findClosestNodeElement(
          worldRef.current,
          worldRect,
          currentWorldX,
          currentWorldY,
          sourceId,
          zoom,
          displaySubgraphs
        );
        if (snap) {
          resolvedTargetId = snap.id;
        } else if (rawTargetId && rawTargetId !== sourceId) {
          resolvedTargetId = rawTargetId;
        }
      } else if (rawTargetId && rawTargetId !== sourceId) {
        resolvedTargetId = rawTargetId;
      }

      if (store.connectingTargetId !== resolvedTargetId) {
        store.setConnectingTargetId(resolvedTargetId);
      }

      // Blocked-drop feedback: ask the driver whether this pair may connect.
      // Pure predicate — the mutation itself stays the enforcement point.
      const isDropBlocked =
        !!resolvedTargetId &&
        (m.canConnect ? !m.canConnect(ast, sourceId, resolvedTargetId) : false);
      if (store.connectBlocked !== isDropBlocked) {
        store.setConnectBlocked(isDropBlocked);
      }

      let sourceRect: Rect | null = null;
      if (getLocalRect && worldRef.current) {
        const sourceEl = worldRef.current.querySelector(
          `[data-mermaid-node-id="${sourceId}"]:not(.mermaid-edge-hit-area)`
        );
        if (sourceEl) {
          sourceRect = getLocalRect(sourceEl);
        }
      }

      store.setDragLine((prev) => {
        if (!prev) return null;
        let x1 = prev.x1;
        let y1 = prev.y1;

        if (sourceRect) {
          const isLifeline =
            worldRef.current?.querySelector(
              `.mermaid-lifeline-hit-area[data-mermaid-node-id="${sourceId}"]`
            ) !== null;

          if (!isLifeline) {
            const anchor = getPerimeterAnchor(sourceRect, currentWorldX, currentWorldY);
            x1 = anchor.x;
            y1 = anchor.y;
          }
        }

        return {
          ...prev,
          x1,
          y1,
          x2: currentWorldX,
          y2: currentWorldY,
        };
      });
      return;
    }

    const isMarquee = marquee.updateMarquee(
      e.clientX,
      e.clientY,
      displayNodes,
      displayEdges
    );

    if (
      !isMarquee &&
      store.hoveredNodeId &&
      store.hoveredNodeRect &&
      worldRef.current &&
      !store.connectingSourceId
    ) {
      const worldRect = worldRef.current.getBoundingClientRect();
      const mouseX = (e.clientX - worldRect.left) / zoom;
      const mouseY = (e.clientY - worldRect.top) / zoom;
      const padX = 16;
      const padY = 24;
      const withinX =
        mouseX >= store.hoveredNodeRect.x - padX &&
        mouseX <= store.hoveredNodeRect.x + store.hoveredNodeRect.width + padX;
      const withinY =
        mouseY >= store.hoveredNodeRect.y - padY &&
        mouseY <= store.hoveredNodeRect.y + store.hoveredNodeRect.height + padY;

      if (!withinX || !withinY) {
        store.setHoveredNode(null, null, null);
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (e.isPrimary === false) return;
    endPan();

    // Discard pending connection if it never exceeded the threshold (it was just a click or dblclick)
    pendingConnectRef.current = null;
    // A quick empty-canvas tap never armed anything; a held one armed marquee above.
    clearTouchEmpty();

    if (marquee.dragBoxStartRef.current) {
      marquee.endMarquee(displayNodes, displayEdges);
    }

    const store = useCanvasStore.getState();
    const cSourceId = store.connectingSourceId;
    const cSourceKind = store.connectingSourceKind ?? store.connectingHandleKind;

    if (cSourceId) {
      const hitEl = getHitElement(e);
      let targetNodeEl: Element | null =
        hitEl?.closest?.('[data-mermaid-node-id]') ?? null;

      // Fallback 1: check if target is inside an element with name matching displayNodes
      if (!targetNodeEl) {
        const namedContainer = hitEl?.closest?.('[name], [data-id]');
        const nameVal =
          namedContainer?.getAttribute('name') || namedContainer?.getAttribute('data-id');
        if (nameVal && displayNodes?.has(nameVal) && namedContainer) {
          targetNodeEl =
            namedContainer.closest('[data-mermaid-node-id]') ||
            namedContainer;
        }
      }

      const directTargetId =
        targetNodeEl?.getAttribute('data-mermaid-node-id') ||
        targetNodeEl?.getAttribute('name') ||
        targetNodeEl?.getAttribute('data-id') ||
        null;

      // Fallback 2: snap to closest node/lifeline within 50px radius.
      // If nothing was hit directly OR if a subgraph was hit,
      // search for real inner nodes so subgraphs never shadow their children.
      if (
        (!targetNodeEl || (directTargetId && displaySubgraphs?.has(directTargetId))) &&
        worldRef.current
      ) {
        const worldRect = worldRef.current.getBoundingClientRect();
        const dropX = (e.clientX - worldRect.left) / zoom;
        const dropY = (e.clientY - worldRect.top) / zoom;
        const snap = findClosestNodeElement(
          worldRef.current,
          worldRect,
          dropX,
          dropY,
          cSourceId,
          zoom,
          displaySubgraphs
        );
        if (snap) {
          targetNodeEl = snap.element;
        }
      }

      const targetNodeId =
        targetNodeEl?.getAttribute('data-mermaid-node-id') ||
        targetNodeEl?.getAttribute('name') ||
        targetNodeEl?.getAttribute('data-id');
      const targetKind = targetNodeEl?.getAttribute('data-mermaid-start-end') as
        | 'start'
        | 'end'
        | null;

      const targetEdgeEl = hitEl?.closest?.('[data-mermaid-edge-id]');
      const targetEdgeId = targetEdgeEl?.getAttribute('data-mermaid-edge-id');

      // Directional guard for start/end anchors.
      const blockedAnchor = isBlockedAnchorEdge(
        cSourceId,
        cSourceKind,
        targetNodeId,
        targetKind,
        isAnchorId
      );

      // Only outer nodes can point to composites; inner nodes cannot point to outer composite.
      const innerToOuterBlocked = isInnerToOuterBlocked(
        cSourceId,
        targetNodeId,
        displayNodes,
        displaySubgraphs
      );

      // Same driver predicate as the hover feedback: a refused drop skips the
      // mutation entirely instead of relying on the mutation no-op.
      const isDropBlocked =
        !!targetNodeId &&
        targetNodeId !== cSourceId &&
        (m.canConnect ? !m.canConnect(ast, cSourceId, targetNodeId) : false);

      if (
        targetNodeId &&
        targetNodeId !== cSourceId &&
        !blockedAnchor &&
        !innerToOuterBlocked &&
        !isDropBlocked
      ) {
        const worldRect = worldRef.current ? worldRef.current.getBoundingClientRect() : null;
        const dropY = worldRect ? (e.clientY - worldRect.top) / zoom : 0;
        const startY = store.dragLine ? store.dragLine.y1 : dropY;
        const connectionY = (startY + dropY) / 2;

        const { insertAfterEdgeId, insertAtIndex } = resolveSequenceInsertion(
          svgMountRef?.current ?? null,
          displayEdges,
          connectionY,
          getLocalRect
        );

        applyMutation((a) => {
          m.connect(a, cSourceId, targetNodeId, {
            insertAfterEdgeId,
            insertAtIndex,
            y: connectionY,
          });
        }, cSourceId);
      } else if (targetEdgeId) {
        let createdNodeId: string | null = null;
        applyMutation((a) => {
          createdNodeId = m.insertNodeOnEdge(a, targetEdgeId, `New ${driver.labels.node}`);
        });
        if (createdNodeId) setSelectedNodeId(createdNodeId);
      }

      store.setConnecting(null, null, null);
    }
  };

  /**
   * A cancelled pointer (palm rejection, gesture taken over by the OS/browser)
   * must never commit a mutation — just release transient drag state.
   */
  const handlePointerCancel = () => {
    endPan();
    pendingConnectRef.current = null;
    clearTouchEmpty();
    marquee.dragBoxStartRef.current = null;
    useCanvasStore.getState().setConnecting(null, null, null);
  };

  return {
    connectingSourceId,
    setConnectingSourceId,
    connectingSourceKind,
    setConnectingSourceKind,
    connectingTargetId,
    connectBlocked,
    dragLine,
    setDragLine,
    hoveredNodeId,
    setHoveredNodeId,
    hoveredNodeRect,
    setHoveredNodeRect,
    hoveredNodeKind,
    setHoveredNodeKind,
    setHoveredNode,
    handleStartConnect,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerCancel,
    /** @deprecated Use handlePointerDown (kept for backward compat). */
    handleMouseDown: handlePointerDown,
    /** @deprecated Use handlePointerMove (kept for backward compat). */
    handleMouseMove: handlePointerMove,
    /** @deprecated Use handlePointerUp (kept for backward compat). */
    handleMouseUp: handlePointerUp,
  };
}
