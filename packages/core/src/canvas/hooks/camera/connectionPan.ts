import type { Rect } from '../../types';

const MAX_SOURCE_PIN_PX = 64;
export const cameraMargins = { side: 40, top: 60, bottom: 40 };

interface Point {
  x: number;
  y: number;
}

export function rectCenter(rect: Rect): Point {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

function fits(rect: Rect, viewport: Rect): boolean {
  return rect.width <= viewport.width && rect.height <= viewport.height;
}

export function containsRect(viewport: Rect, rect: Rect): boolean {
  return rect.x >= viewport.x && rect.y >= viewport.y &&
    rect.x + rect.width <= viewport.x + viewport.width &&
    rect.y + rect.height <= viewport.y + viewport.height;
}

function union(a: Rect, b: Rect): Rect {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x, y,
    width: Math.max(a.x + a.width, b.x + b.width) - x,
    height: Math.max(a.y + a.height, b.y + b.height) - y,
  };
}

interface ConnectionPanGeometry {
  viewport: Rect;
  padded: Rect;
  wasFullyVisible: boolean;
  oldSourceCenter: Point;
  diagram: Rect;
  source: Rect;
  target: Rect;
}

export function getConnectionPan({
  viewport, padded, wasFullyVisible, oldSourceCenter, diagram, source, target,
}: ConnectionPanGeometry): Point {
  const endpoints = union(source, target);
  let visible = target;
  if (wasFullyVisible && fits(diagram, viewport)) {
    visible = diagram;
  } else if (fits(endpoints, viewport)) {
    visible = endpoints;
  } else if (!fits(target, viewport)) {
    visible = { ...rectCenter(target), width: 0, height: 0 };
  }
  const bounds = fits(visible, padded) ? padded : viewport;
  const center = rectCenter(source);
  const pin = { x: oldSourceCenter.x - center.x, y: oldSourceCenter.y - center.y };
  if (Math.hypot(pin.x, pin.y) <= MAX_SOURCE_PIN_PX &&
      containsRect(bounds, { ...visible, x: visible.x + pin.x, y: visible.y + pin.y })) {
    return pin;
  }

  // Clamp zero to the interval of pan offsets that keep the chosen content in view.
  return {
    x: Math.max(bounds.x - visible.x, Math.min(0, bounds.x + bounds.width - visible.x - visible.width)),
    y: Math.max(bounds.y - visible.y, Math.min(0, bounds.y + bounds.height - visible.y - visible.height)),
  };
}
