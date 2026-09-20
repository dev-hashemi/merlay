import React from 'react';
import { Rect } from '../../types';

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

/**
 * Resolves the topmost DOM element underneath the pointer, bypassing any
 * pointer capture redirection so hit-testing targets the visual element.
 */
export function getHitElement(e: React.PointerEvent): Element | null {
  if (typeof document !== 'undefined' && typeof document.elementFromPoint === 'function') {
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (el) return el;
  }
  return e.target instanceof Element ? e.target : null;
}
