/**
 * Geometry and proximity calculations for SVG edges.
 * Enables pixel-accurate hit-testing and hover selection so that when
 * a long arrow and a short arrow are close to each other, the one closest
 * to the mouse cursor is chosen instead of relying on SVG DOM stacking order.
 */

export function getDistanceToSvgPath(
  pathEl: SVGPathElement,
  clientX: number,
  clientY: number
): number {
  if (!pathEl || typeof pathEl.getBoundingClientRect !== 'function') {
    return Infinity;
  }

  const bbox = pathEl.getBoundingClientRect();
  const padding = 25;
  if (
    clientX < bbox.left - padding ||
    clientX > bbox.right + padding ||
    clientY < bbox.top - padding ||
    clientY > bbox.bottom + padding
  ) {
    return Infinity;
  }

  const ctm = typeof pathEl.getScreenCTM === 'function' ? pathEl.getScreenCTM() : null;
  const totalLength = typeof pathEl.getTotalLength === 'function' ? pathEl.getTotalLength() : 0;
  if (!ctm || totalLength <= 0) {
    const dx = Math.max(bbox.left - clientX, 0, clientX - bbox.right);
    const dy = Math.max(bbox.top - clientY, 0, clientY - bbox.bottom);
    return Math.hypot(dx, dy);
  }

  // Sample points along the SVG path to find the exact closest point
  const numSamples = Math.max(12, Math.min(60, Math.ceil(totalLength / 10)));
  const step = totalLength / numSamples;
  let minDist = Infinity;

  for (let i = 0; i <= numSamples; i++) {
    const pt = pathEl.getPointAtLength(i * step);
    const screenX = pt.x * ctm.a + pt.y * ctm.c + ctm.e;
    const screenY = pt.x * ctm.b + pt.y * ctm.d + ctm.f;
    const dist = Math.hypot(screenX - clientX, screenY - clientY);
    if (dist < minDist) {
      minDist = dist;
    }
  }

  return minDist;
}
