import { useCallback, useLayoutEffect, useRef } from 'react';
import { findNodeEditElement } from '../../interaction/nodeElement';
import type { ConnectionCameraTarget, Rect } from '../../types';
import { cameraMargins, containsRect, getConnectionPan, rectCenter } from './connectionPan';

interface PendingConnection extends ConnectionCameraTarget {
  code: string;
  oldSourceCenter: ReturnType<typeof rectCenter>;
  wasFullyVisible: boolean;
}

function measure(element: Element | null | undefined): Rect | null {
  if (!element) return null;
  const { x, y, width, height } = element.getBoundingClientRect();
  if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return null;
  return { x, y, width, height };
}

export function useConnectionCamera(
  code: string | undefined,
  containerRef: React.RefObject<HTMLDivElement> | undefined,
  worldRef: React.RefObject<HTMLDivElement>,
  svgMountRef: React.RefObject<HTMLDivElement>,
) {
  const pending = useRef<PendingConnection | null>(null);

  useLayoutEffect(() => {
    if (pending.current && pending.current.code !== code) pending.current = null;
  }, [code]);

  const clear = useCallback(() => {
    pending.current = null;
  }, []);

  const measureViewport = useCallback(() => {
    const container = measure(containerRef?.current ?? worldRef.current?.parentElement);
    if (!container || container.height <= cameraMargins.top) return null;
    return {
      x: container.x,
      y: container.y + cameraMargins.top,
      width: container.width,
      height: container.height - cameraMargins.top,
    };
  }, [containerRef, worldRef]);

  const capture = useCallback((nextCode: string, endpoints: ConnectionCameraTarget) => {
    clear();
    const mount = svgMountRef.current;
    const diagram = measure(mount?.querySelector('svg'));
    const source = measure(findNodeEditElement(mount, endpoints.sourceId));
    const viewport = measureViewport();
    if (!diagram || !source || !viewport) return;
    pending.current = {
      ...endpoints,
      code: nextCode,
      oldSourceCenter: rectCenter(source),
      wasFullyVisible: containsRect(viewport, diagram),
    };
  }, [clear, measureViewport, svgMountRef]);

  const settle = useCallback((renderedCode: string | undefined, success: boolean) => {
    const request = pending.current;
    if (!request || request.code !== renderedCode) return null;
    clear();
    if (!success) return null;

    const mount = svgMountRef.current;
    const diagram = measure(mount?.querySelector('svg'));
    const source = measure(findNodeEditElement(mount, request.sourceId));
    const target = measure(findNodeEditElement(mount, request.targetId));
    const viewport = measureViewport();
    if (!diagram || !source || !target || !viewport) return null;
    const padded = viewport.width > cameraMargins.side * 2 && viewport.height > cameraMargins.bottom
      ? {
          x: viewport.x + cameraMargins.side,
          y: viewport.y,
          width: viewport.width - cameraMargins.side * 2,
          height: viewport.height - cameraMargins.bottom,
        }
      : viewport;
    return getConnectionPan({ ...request, diagram, source, target, viewport, padded });
  }, [clear, measureViewport, svgMountRef]);

  return { capture, settle, clear };
}
