import { useState, useRef, useCallback, useEffect } from 'react';
import { Rect } from '../types';

export interface UseCanvasCameraOptions {
  containerRef?: React.RefObject<HTMLDivElement>;
  worldRef: React.RefObject<HTMLDivElement>;
  svgMountRef: React.RefObject<HTMLDivElement>;
}

export function useCanvasCamera({
  containerRef,
  worldRef,
  svgMountRef,
}: UseCanvasCameraOptions) {
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);

  const zoomRef = useRef<number>(1);
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const pinchRef = useRef<{
    startDist: number;
    startMidX: number;
    startMidY: number;
    startZoom: number;
    startPanX: number;
    startPanY: number;
  } | null>(null);
  const pendingCameraPinRef = useRef<{
    nodeId: string;
    screenX: number;
    screenY: number;
  } | null>(null);

  // True once the user takes manual camera control (zoom/pan). While false
  // the camera is a fresh fit, so container resizes (sidebar toggles, pane
  // splits, window resizes) re-fit instead of stranding the diagram.
  const userAdjustedCameraRef = useRef<boolean>(false);

  // Convert an SVG/DOM element bounding rect to world coordinates
  const getLocalRect = useCallback((el: Element): Rect | null => {
    if (!worldRef.current) return null;
    const worldRect = worldRef.current.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    if (elRect.width === 0 && elRect.height === 0) return null;
    const currentZoom = zoomRef.current;
    return {
      x: (elRect.left - worldRect.left) / currentZoom,
      y: (elRect.top - worldRect.top) / currentZoom,
      width: elRect.width / currentZoom,
      height: elRect.height / currentZoom,
    };
  }, [worldRef]);

  // Convert client coordinates to canvas world coordinates
  const getLocalPoint = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } | null => {
      if (!worldRef.current) return null;
      const worldRect = worldRef.current.getBoundingClientRect();
      const currentZoom = zoomRef.current;
      return {
        x: (clientX - worldRect.left) / currentZoom,
        y: (clientY - worldRect.top) / currentZoom,
      };
    },
    [worldRef]
  );

  // Record screen position of active node to stabilize camera across re-render
  const pinNodeForCamera = useCallback((nodeId: string) => {
    if (!svgMountRef.current) return;
    const activeEl = svgMountRef.current.querySelector(
      `[data-mermaid-node-id="${nodeId}"]`
    );
    if (activeEl) {
      const b = activeEl.getBoundingClientRect();
      pendingCameraPinRef.current = {
        nodeId,
        screenX: b.left + b.width / 2,
        screenY: b.top + b.height / 2,
      };
    }
  }, [svgMountRef]);

  // Readjust camera pan after re-rendering so mutated node remains visually stationary
  const stabilizeCamera = useCallback(() => {
    const pin = pendingCameraPinRef.current;
    if (!pin || !svgMountRef.current) return;
    pendingCameraPinRef.current = null;

    const activeEl = svgMountRef.current.querySelector(
      `[data-mermaid-node-id="${pin.nodeId}"]`
    );
    if (!activeEl) return;

    const b = activeEl.getBoundingClientRect();
    const newScreenX = b.left + b.width / 2;
    const newScreenY = b.top + b.height / 2;

    const deltaX = pin.screenX - newScreenX;
    const deltaY = pin.screenY - newScreenY;

    if (Math.abs(deltaX) > 1 || Math.abs(deltaY) > 1) {
      setPan((prev) => ({
        x: prev.x + deltaX,
        y: prev.y + deltaY,
      }));
    }
  }, [svgMountRef]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    userAdjustedCameraRef.current = true;
    if (e.ctrlKey || e.metaKey) {
      // Zoom
      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      setZoom((prevZoom) => {
        const newZoom = Math.min(Math.max(prevZoom * zoomFactor, 0.2), 3);
        zoomRef.current = newZoom;
        return newZoom;
      });
    } else {
      // Pan
      setPan((prev) => ({
        x: prev.x - e.deltaX,
        y: prev.y - e.deltaY,
      }));
    }
  }, []);

  const handleFitView = useCallback(() => {
    const container = containerRef?.current || worldRef.current?.parentElement;
    const svg = svgMountRef.current?.querySelector('svg');
    if (!container || !svg) {
      setZoom(1);
      zoomRef.current = 1;
      setPan({ x: 0, y: 0 });
      return;
    }

    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    if (containerWidth === 0 || containerHeight === 0) {
      setZoom(1);
      zoomRef.current = 1;
      setPan({ x: 0, y: 0 });
      return;
    }

    // Determine the natural (unzoomed) dimensions and world position of the SVG
    let svgWidth = 0;
    let svgHeight = 0;
    let svgWorldX = 0;
    let svgWorldY = 0;

    const localRect = getLocalRect(svg);
    if (localRect && localRect.width > 0 && localRect.height > 0) {
      svgWidth = localRect.width;
      svgHeight = localRect.height;
      svgWorldX = localRect.x;
      svgWorldY = localRect.y;
    } else {
      // Fallback: Try viewBox (Mermaid SVGs define natural dimensions in viewBox)
      const viewBox = svg.getAttribute('viewBox');
      if (viewBox) {
        const parts = viewBox.trim().split(/[\s,]+/);
        if (parts.length === 4) {
          const w = parseFloat(parts[2]);
          const h = parseFloat(parts[3]);
          if (!isNaN(w) && w > 0 && !isNaN(h) && h > 0) {
            svgWidth = w;
            svgHeight = h;
          }
        }
      }

      if (!svgWidth) {
        svgWidth = parseFloat(svg.getAttribute('width') || '') || svg.clientWidth;
      }
      if (!svgHeight) {
        svgHeight = parseFloat(svg.getAttribute('height') || '') || svg.clientHeight;
      }

      const mount = svgMountRef.current;
      svgWorldX = mount?.offsetLeft ?? 80;
      svgWorldY = mount?.offsetTop ?? 80;
    }

    if (svgWidth <= 0 || svgHeight <= 0) {
      setZoom(1);
      zoomRef.current = 1;
      setPan({ x: 0, y: 0 });
      return;
    }

    // Margins: account for the top bar (~60px) and comfortable border padding
    const padX = 80;
    const topBarHeight = 60;
    const padBottom = 40;

    const availWidth = Math.max(containerWidth - padX, 100);
    const availHeight = Math.max(containerHeight - (topBarHeight + padBottom), 100);

    // Compute fit scale, bounded between 0.15 and 1.15 to avoid over-magnifying small diagrams
    const fitScale = Math.min(availWidth / svgWidth, availHeight / svgHeight);
    const newZoom = Math.min(Math.max(fitScale, 0.15), 1.15);

    // Exact geometric centering:
    // Screen X of diagram center = panX + (svgWorldX + svgWidth / 2) * newZoom
    // Desired Screen X of diagram center = containerWidth / 2
    const diagramCenterX = svgWorldX + svgWidth / 2;
    const panX = containerWidth / 2 - diagramCenterX * newZoom;

    // Desired Screen Y of diagram center = topBarHeight + availHeight / 2
    const diagramCenterY = svgWorldY + svgHeight / 2;
    const targetCenterY = topBarHeight + availHeight / 2;
    const panY = targetCenterY - diagramCenterY * newZoom;

    setZoom(newZoom);
    zoomRef.current = newZoom;
    setPan({ x: Math.round(panX), y: Math.round(panY) });
    userAdjustedCameraRef.current = false;
  }, [containerRef, worldRef, svgMountRef, getLocalRect]);

  // Responsive camera: re-fit when the container resizes (host sidebar
  // toggles, pane splits, window resizes) as long as the user has not taken
  // manual camera control. rAF-throttled and jitter-guarded so open
  // animations settle into a single final fit.
  useEffect(() => {
    const el = containerRef?.current ?? worldRef.current?.parentElement ?? null;
    if (!el || typeof window === 'undefined') return;
    let raf = 0;
    let lastW = el.clientWidth;
    let lastH = el.clientHeight;
    const maybeRefit = (): void => {
      raf = 0;
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w <= 0 || h <= 0) {
        lastW = w;
        lastH = h;
        return;
      }
      if (Math.abs(w - lastW) < 2 && Math.abs(h - lastH) < 2) return;
      lastW = w;
      lastH = h;
      if (!userAdjustedCameraRef.current) handleFitView();
    };
    const schedule = (): void => {
      if (raf) return;
      raf = window.requestAnimationFrame(maybeRefit);
    };
    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(schedule);
      observer.observe(el);
    } else {
      window.addEventListener('resize', schedule);
    }
    return () => {
      if (raf) window.cancelAnimationFrame(raf);
      observer?.disconnect();
      window.removeEventListener('resize', schedule);
    };
  }, [containerRef, worldRef, handleFitView]);

  const startPan = useCallback((clientX: number, clientY: number) => {
    setIsPanning(true);
    panStartRef.current = {
      x: clientX - pan.x,
      y: clientY - pan.y,
    };
  }, [pan]);

  const updatePan = useCallback((clientX: number, clientY: number) => {
    userAdjustedCameraRef.current = true;
    setPan({
      x: clientX - panStartRef.current.x,
      y: clientY - panStartRef.current.y,
    });
  }, []);

  const endPan = useCallback(() => {
    setIsPanning(false);
  }, []);

  /**
   * Two-finger pinch-zoom for touchscreens. Zoom is centered so the world
   * point under the gesture midpoint stays put, then follows the fingers.
   */
  const startPinch = useCallback(
    (dist: number, midX: number, midY: number) => {
      pinchRef.current = {
        startDist: Math.max(dist, 1),
        startMidX: midX,
        startMidY: midY,
        startZoom: zoomRef.current,
        startPanX: pan.x,
        startPanY: pan.y,
      };
    },
    [pan]
  );

  const updatePinch = useCallback((dist: number, midX: number, midY: number) => {
    const s = pinchRef.current;
    if (!s || s.startDist <= 0) return;
    userAdjustedCameraRef.current = true;
    const newZoom = Math.min(Math.max(s.startZoom * (dist / s.startDist), 0.2), 3);
    zoomRef.current = newZoom;
    setZoom(newZoom);
    const scale = newZoom / s.startZoom;
    setPan({
      x: midX - (s.startMidX - s.startPanX) * scale,
      y: midY - (s.startMidY - s.startPanY) * scale,
    });
  }, []);

  const endPinch = useCallback(() => {
    pinchRef.current = null;
  }, []);

  return {
    zoom,
    setZoom,
    pan,
    setPan,
    isPanning,
    setIsPanning,
    zoomRef,
    panStartRef,
    pendingCameraPinRef,
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
  };
}
