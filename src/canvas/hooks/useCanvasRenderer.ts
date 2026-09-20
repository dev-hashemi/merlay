/**
 * Hook to manage Mermaid SVG rendering, camera stabilization, unmatched subgraph discovery,
 * and binding SVG DOM interactivity via the centralized Zustand store.
 */

import React, { useEffect, useRef, useCallback } from 'react';
import type { RenderMermaidFn } from '../../platform/types';
import { Rect } from '../types';
import { MermaidNodeDef, MermaidEdgeDef, MermaidSubgraphDef } from '../../diagrams/viewModel';
import { DiagramDriver } from '../../diagrams/types';
import { mountMermaidSvg } from '../renderer/mermaidRenderer';
import { setupSvgInteractivity } from '../interaction/setupSvgInteractivity';
import { setupViewOnlyInteractivity } from '../interaction/setupViewOnlyInteractivity';
import { useCanvasStore } from '../store/canvasStore';
import { createRendererSelectionHandlers } from './renderer/rendererSelectionHandlers';

export interface UseCanvasRendererOptions {
  renderMermaid: RenderMermaidFn;
  code: string;
  driver: DiagramDriver;
  svgMountRef: React.RefObject<HTMLDivElement>;
  displayNodes: Map<string, MermaidNodeDef>;
  displayEdges: MermaidEdgeDef[];
  displaySubgraphs: Map<string, MermaidSubgraphDef>;
  getLocalRect: (el: Element) => Rect | null;
  getLocalPoint?: (clientX: number, clientY: number) => { x: number; y: number } | null;
  updateSelectedNodeHalo: (nodes?: Set<string>) => void;
  updateSelectedEdgeHalo: (edges?: Set<string>) => void;
  updateSelectedNodeRect: () => void;
  inlineEditing: {
    startEditingEdge: (edgeId: string, edgeEl: Element) => void;
    startEditingSubgraph: (subId: string, subEl: Element) => void;
    setEditingNodeId: (id: string | null) => void;
  };
  handleStartEditingNode: (nodeId: string, el: Element) => void;
  stabilizeCamera: () => void;
  setSyntaxError: (err: string | null) => void;
  onInitialRender?: () => void;
}

export function useCanvasRenderer({
  renderMermaid,
  code,
  driver,
  svgMountRef,
  displayNodes,
  displayEdges,
  displaySubgraphs,
  getLocalRect,
  getLocalPoint,
  updateSelectedNodeHalo,
  updateSelectedEdgeHalo,
  updateSelectedNodeRect,
  inlineEditing,
  handleStartEditingNode,
  stabilizeCamera,
  setSyntaxError,
  onInitialRender,
}: UseCanvasRendererOptions) {
  const renderTicketRef = useRef<number>(0);
  const viewOnlyCleanupRef = useRef<(() => void) | null>(null);
  const anchors = driver.mutations.anchors;
  const isAnchorId = (id: string | null | undefined): id is string =>
    !!anchors && !!id && anchors.isAnchor(id);

  const isEditable = driver.capabilities.editable !== false;

  const setupSvg = useCallback(() => {
    const mountEl = svgMountRef.current;
    if (!mountEl) return;

    if (!isEditable) {
      // The listener lives on mountEl itself, so clearing the mount on the next
      // render would NOT remove it — dispose the previous one first or every
      // re-render stacks another click handler (shift-click toggles twice and
      // appears to do nothing).
      viewOnlyCleanupRef.current?.();
      viewOnlyCleanupRef.current = setupViewOnlyInteractivity({ mountEl });
      return;
    }

    const { onSelectNode, onSelectEdge, onSelectSubgraph } = createRendererSelectionHandlers({
      mountEl,
      driver,
      getLocalRect,
      updateSelectedNodeHalo,
      updateSelectedEdgeHalo,
      setEditingNodeId: inlineEditing.setEditingNodeId,
      isAnchorId,
    });

    setupSvgInteractivity({
      mountEl,
      dom: driver.dom,
      displayNodes,
      displayEdges,
      displaySubgraphs,
      getLocalRect,
      getLocalPoint,
      onSelectNode,
      onSelectEdge,
      onSelectSubgraph,
      onStartEditingNode: handleStartEditingNode,
      onStartEditingEdge: inlineEditing.startEditingEdge,
      onStartEditingSubgraph: inlineEditing.startEditingSubgraph,
      onHoverNode: (nodeId, rect, kind) => {
        useCanvasStore.getState().setHoveredNode(nodeId, rect, kind ?? null);
      },
    });
  }, [
    svgMountRef,
    isEditable,
    driver,
    displayNodes,
    displayEdges,
    displaySubgraphs,
    getLocalRect,
    getLocalPoint,
    updateSelectedNodeHalo,
    updateSelectedEdgeHalo,
    inlineEditing,
    handleStartEditingNode,
  ]);

  // Stable refs for renderer effect
  const setupRef = useRef(setupSvg);
  setupRef.current = setupSvg;
  const stabilizeRef = useRef(stabilizeCamera);
  stabilizeRef.current = stabilizeCamera;
  const rectRef = useRef(updateSelectedNodeRect);
  rectRef.current = updateSelectedNodeRect;
  const haloNodeRef = useRef(updateSelectedNodeHalo);
  haloNodeRef.current = updateSelectedNodeHalo;
  const haloEdgeRef = useRef(updateSelectedEdgeHalo);
  haloEdgeRef.current = updateSelectedEdgeHalo;
  const subgraphsRef = useRef(displaySubgraphs);
  subgraphsRef.current = displaySubgraphs;
  const onInitialRenderRef = useRef(onInitialRender);
  onInitialRenderRef.current = onInitialRender;
  const hasRenderedOnceRef = useRef<boolean>(false);

  // Render effect
  // NOTE: displayNodes/displayEdges/displaySubgraphs are intentionally part
  // of the deps. Undo/redo applies code first (re-render with stale AST) and
  // only then re-parses into a fresh AST. Without these deps the SVG would
  // keep interactivity bound to the stale AST, leaving the redone edge/group
  // without hit areas (unselectable). Including them forces a second pass
  // with the fresh projection once the AST catches up.
  useEffect(() => {
    const mountEl = svgMountRef.current;
    if (!mountEl) return;

    const ticket = ++renderTicketRef.current;

    renderMermaid(code)
      .then((svgHtml) => {
        if (ticket !== renderTicketRef.current) return;
        // Parsed as XML and adopted into the DOM (no innerHTML), preserving
        // Mermaid's embedded theme <style> that Obsidian's HTML sanitizer
        // would strip.
        mountMermaidSvg(mountEl, svgHtml);
        setSyntaxError(null);

        setupRef.current();
        stabilizeRef.current();
        rectRef.current();
        haloNodeRef.current();
        haloEdgeRef.current();

        if (!hasRenderedOnceRef.current) {
          hasRenderedOnceRef.current = true;
          onInitialRenderRef.current?.();
        }

        try {
          const rendered = new Set<string>();
          mountEl.querySelectorAll('[data-mermaid-subgraph-id]').forEach((el) => {
            const id = el.getAttribute('data-mermaid-subgraph-id');
            if (id) rendered.add(id);
          });
          const missing: string[] = [];
          for (const subId of subgraphsRef.current.keys()) {
            if (!rendered.has(subId)) missing.push(subId);
          }
          useCanvasStore.getState().setUnmatchedSubgraphIds((prev) => {
            if (prev.length === missing.length && prev.every((id) => missing.includes(id))) {
              return prev;
            }
            return missing;
          });
        } catch {
          /* ignore */
        }
      })
      .catch((err: unknown) => {
        if (ticket !== renderTicketRef.current) return;
        console.error('Mermaid render error:', err);
        setSyntaxError(err instanceof Error ? err.message : 'Diagram syntax error');
      });

    return () => {
      viewOnlyCleanupRef.current?.();
      viewOnlyCleanupRef.current = null;
      // Invalidate in-flight renders so a late resolution never touches an
      // unmounted or re-rendered view.
      renderTicketRef.current++;
    };
  }, [code, renderMermaid, setSyntaxError, svgMountRef, displayNodes, displayEdges, displaySubgraphs]);
}
