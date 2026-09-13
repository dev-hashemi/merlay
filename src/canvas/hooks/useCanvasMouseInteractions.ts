/**
 * Hook for Canvas mouse interactions: panning, connection dragging, node hover proximity, and marquee triggering.
 */

import React, { useCallback, useRef } from 'react';
import { CursorMode, Rect } from '../types';
import { DiagramDriver } from '../../diagrams/types';
import { MermaidNodeDef, MermaidEdgeDef, MermaidSubgraphDef } from '../../diagrams/viewModel';
import { DragLine, useCanvasStore } from '../store/canvasStore';

/**
 * Calculates the point on the perimeter of a rectangle that intersects
 * the ray from the center of the rectangle to (targetX, targetY).
 */
export function getPerimeterAnchor(
  rect: Rect,
  targetX: number,
  targetY: number
): { x: number; y: number } {
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  const dx = targetX - cx;
  const dy = targetY - cy;

  if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) {
    return { x: cx, y: rect.y + rect.height };
  }

  const halfW = Math.max(rect.width / 2, 1);
  const halfH = Math.max(rect.height / 2, 1);

  const scaleX = Math.abs(dx) > 0.0001 ? halfW / Math.abs(dx) : Infinity;
  const scaleY = Math.abs(dy) > 0.0001 ? halfH / Math.abs(dy) : Infinity;
  const scale = Math.min(scaleX, scaleY);

  return {
    x: cx + dx * scale,
    y: cy + dy * scale,
  };
}

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

  const handleStartConnect = (
    e: React.MouseEvent,
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

  const handleMouseDown = (e: React.MouseEvent) => {
    if (
      (e.target as HTMLElement).closest('.nodrag') ||
      (e.target as HTMLElement).closest('.mermaid-action-hud') ||
      (e.target as HTMLElement).closest('.mermaid-multiselect-hud') ||
      (e.target as HTMLElement).closest('.mermaid-edge-hud')
    ) {
      return;
    }

    const isMiddleClick = e.button === 1;
    const isHandModeActive =
      cursorMode === 'hand' ||
      isSpacePressed ||
      isMiddleClick;

    if (isHandModeActive) {
      startPan(e.clientX, e.clientY);
      return;
    }

    if (e.button !== 0) return;

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
      // Do not start marquee when clicking on a node!
      return;
    }

    // Empty canvas click starts marquee selection
    marquee.startMarquee(e.clientX, e.clientY);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      updatePan(e.clientX, e.clientY);
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
      const rawTarget = (e.target as HTMLElement)?.closest?.('[data-mermaid-node-id]');
      const rawTargetId =
        rawTarget?.getAttribute('data-mermaid-node-id') ||
        rawTarget?.getAttribute('name') ||
        rawTarget?.getAttribute('data-id') ||
        null;
      const resolvedTargetId =
        rawTargetId && rawTargetId !== sourceId ? rawTargetId : null;
      if (store.connectingTargetId !== resolvedTargetId) {
        store.setConnectingTargetId(resolvedTargetId);
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

  const handleMouseUp = (e: React.MouseEvent) => {
    endPan();

    // Discard pending connection if it never exceeded the threshold (it was just a click or dblclick)
    pendingConnectRef.current = null;

    if (marquee.dragBoxStartRef.current) {
      marquee.endMarquee(displayNodes, displayEdges);
    }

    const store = useCanvasStore.getState();
    const cSourceId = store.connectingSourceId;
    const cSourceKind = store.connectingSourceKind ?? store.connectingHandleKind;

    if (cSourceId) {
      let targetNodeEl: Element | null = (e.target as HTMLElement).closest(
        '[data-mermaid-node-id]'
      );

      // Fallback 1: check if target is inside an element with name matching displayNodes
      if (!targetNodeEl) {
        const namedContainer = (e.target as HTMLElement).closest('[name], [data-id]');
        const nameVal =
          namedContainer?.getAttribute('name') || namedContainer?.getAttribute('data-id');
        if (nameVal && displayNodes.has(nameVal)) {
          targetNodeEl =
            (namedContainer as HTMLElement).closest('[data-mermaid-node-id]') ||
            namedContainer;
        }
      }

      // Fallback 2: snap to closest node/lifeline within 45px radius
      if (!targetNodeEl && worldRef.current) {
        const worldRect = worldRef.current.getBoundingClientRect();
        const dropX = (e.clientX - worldRect.left) / zoom;
        const dropY = (e.clientY - worldRect.top) / zoom;
        let closestDist = 50;
        const candidates = Array.from(
          worldRef.current.querySelectorAll('[data-mermaid-node-id]')
        );
        for (const cand of candidates) {
          const nid = cand.getAttribute('data-mermaid-node-id');
          if (nid && nid !== cSourceId) {
            const r = cand.getBoundingClientRect();
            const candX = (r.left - worldRect.left) / zoom;
            const candY = (r.top - worldRect.top) / zoom;
            const candW = r.width / zoom;
            const candH = r.height / zoom;
            const dx = Math.max(candX - dropX, 0, dropX - (candX + candW));
            const dy = Math.max(candY - dropY, 0, dropY - (candY + candH));
            const dist = Math.hypot(dx, dy);
            if (dist < closestDist) {
              closestDist = dist;
              targetNodeEl = cand;
            }
          }
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

      const targetEdgeEl = (e.target as HTMLElement).closest(
        '[data-mermaid-edge-id]'
      );
      const targetEdgeId = targetEdgeEl?.getAttribute('data-mermaid-edge-id');

      // Directional guard for start/end anchors.
      const srcIsStart = isAnchorId(cSourceId) && cSourceKind === 'start';
      const srcIsEnd = isAnchorId(cSourceId) && cSourceKind === 'end';
      const tgtIsStart = isAnchorId(targetNodeId) && targetKind === 'start';
      const tgtIsEnd = isAnchorId(targetNodeId) && targetKind === 'end';

      const isBlockedAnchorEdge =
        (isAnchorId(targetNodeId) && isAnchorId(cSourceId)) ||
        srcIsEnd ||
        tgtIsStart ||
        (isAnchorId(targetNodeId) && !tgtIsEnd) ||
        (isAnchorId(cSourceId) && !srcIsStart);

      // Only outer nodes can point to composites; inner nodes cannot point to outer composite.
      const isInnerToOuterBlocked = (() => {
        if (!targetNodeId || !cSourceId || !displaySubgraphs) return false;
        if (!displaySubgraphs.has(targetNodeId)) return false;
        const subgraphs = displaySubgraphs;
        const isSourceInsideTarget = (srcId: string, tgtSubId: string): boolean => {
          if (srcId === tgtSubId) return true;
          const node = displayNodes.get(srcId);
          if (node?.subgraphId) {
            if (node.subgraphId === tgtSubId) return true;
            return isSourceInsideTarget(node.subgraphId, tgtSubId);
          }
          const sub = subgraphs.get(srcId);
          if (sub) {
            for (const parent of subgraphs.values()) {
              if (parent.subgraphIds?.includes(srcId)) {
                if (parent.id === tgtSubId) return true;
                return isSourceInsideTarget(parent.id, tgtSubId);
              }
            }
          }
          return false;
        };
        return isSourceInsideTarget(cSourceId, targetNodeId);
      })();

      // Official Mermaid rule: inner nodes of different composite states cannot transition directly
      const isCrossCompositeBlocked = (() => {
        if (!targetNodeId || !cSourceId || !displayNodes) return false;
        const srcNode = displayNodes.get(cSourceId);
        const tgtNode = displayNodes.get(targetNodeId);
        if (
          srcNode?.subgraphId &&
          tgtNode?.subgraphId &&
          srcNode.subgraphId !== tgtNode.subgraphId
        ) {
          return true;
        }
        return false;
      })();

      if (
        targetNodeId &&
        targetNodeId !== cSourceId &&
        !isBlockedAnchorEdge &&
        !isInnerToOuterBlocked &&
        !isCrossCompositeBlocked
      ) {
        const worldRect = worldRef.current ? worldRef.current.getBoundingClientRect() : null;
        const dropY = worldRect ? (e.clientY - worldRect.top) / zoom : 0;
        const startY = store.dragLine ? store.dragLine.y1 : dropY;
        const connectionY = (startY + dropY) / 2;

        let insertAfterEdgeId: string | undefined = undefined;
        let insertAtIndex: number | undefined = undefined;

        if (svgMountRef?.current && getLocalRect && displayEdges && displayEdges.length > 0) {
          const edgeYPositions: Array<{ id: string; y: number }> = [];
          for (const edge of displayEdges) {
            const edgeEl = svgMountRef.current.querySelector(
              `[data-mermaid-edge-id="${edge.id}"]:not(.mermaid-edge-hit-area):not(.mermaid-edge-selected-clone):not(.mermaid-edge-hovered-clone)`
            );
            if (edgeEl) {
              const r = getLocalRect(edgeEl);
              if (r) {
                edgeYPositions.push({ id: edge.id, y: r.y + r.height / 2 });
              }
            }
          }

          edgeYPositions.sort((a, b) => a.y - b.y);

          if (edgeYPositions.length > 0) {
            if (connectionY < edgeYPositions[0].y) {
              insertAtIndex = 0;
            } else {
              for (let i = edgeYPositions.length - 1; i >= 0; i--) {
                if (edgeYPositions[i].y <= connectionY) {
                  insertAfterEdgeId = edgeYPositions[i].id;
                  break;
                }
              }
            }
          }
        }

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

  return {
    connectingSourceId,
    setConnectingSourceId,
    connectingSourceKind,
    setConnectingSourceKind,
    connectingTargetId,
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
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
  };
}
