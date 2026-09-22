/**
 * Geometry and proximity calculations for SVG edges.
 * Enables pixel-accurate hit-testing and hover selection so that when
 * a long arrow and a short arrow are close to each other, the one closest
 * to the mouse cursor is chosen instead of relying on SVG DOM stacking order.
 */

/**
 * Maps an SVG user-units point to client (screen) pixels.
 *
 * Prefers the element's own bboxes: getBBox() is in user units while
 * getBoundingClientRect() is in client px, and the canvas camera is only
 * ever translate + uniform scale — so one scale factor maps exactly.
 * getScreenCTM is only a fallback because it does not see the CSS
 * zoom/pan transform applied to the canvas wrapper, which made every
 * distance wrong as soon as the user zoomed.
 */
function makeUserToClient(
  pathEl: SVGPathElement,
  clientBox: { left: number; top: number; width: number; height: number }
): ((x: number, y: number) => [number, number]) | null {
  try {
    if (typeof pathEl.getBBox === 'function') {
      // getBBox() is pure geometry (no stroke) in user units; the client
      // box additionally carries stroke/caps. Both dilate symmetrically, so
      // bbox centers correspond exactly under translate + uniform scale.
      const u = pathEl.getBBox();
      const scale =
        u.width > 1e-6
          ? clientBox.width / u.width
          : u.height > 1e-6
            ? clientBox.height / u.height
            : NaN;
      if (Number.isFinite(scale) && scale > 0) {
        const ucx = u.x + u.width / 2;
        const ucy = u.y + u.height / 2;
        const ccx = clientBox.left + clientBox.width / 2;
        const ccy = clientBox.top + clientBox.height / 2;
        return (x, y) => [ccx + (x - ucx) * scale, ccy + (y - ucy) * scale];
      }
    }
  } catch {
    // Detached or hidden SVG: getBBox() throws. Fall through to the CTM.
  }
  if (typeof pathEl.getScreenCTM === 'function') {
    const ctm = pathEl.getScreenCTM();
    if (ctm) {
      return (x, y) => [
        x * ctm.a + y * ctm.c + ctm.e,
        x * ctm.b + y * ctm.d + ctm.f,
      ];
    }
  }
  return null;
}

function bboxDistance(
  bbox: { left: number; right: number; top: number; bottom: number },
  clientX: number,
  clientY: number
): number {
  const dx = Math.max(bbox.left - clientX, 0, clientX - bbox.right);
  const dy = Math.max(bbox.top - clientY, 0, clientY - bbox.bottom);
  return Math.hypot(dx, dy);
}

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

  const totalLength = typeof pathEl.getTotalLength === 'function' ? pathEl.getTotalLength() : 0;
  const toClient = makeUserToClient(pathEl, bbox);
  if (!(totalLength > 0) || !toClient) {
    return bboxDistance(bbox, clientX, clientY);
  }

  // Sample points along the SVG path to find the exact closest point
  const numSamples = Math.max(12, Math.min(60, Math.ceil(totalLength / 10)));
  const step = totalLength / numSamples;
  let minDist = Infinity;

  for (let i = 0; i <= numSamples; i++) {
    const pt = pathEl.getPointAtLength(i * step);
    const [screenX, screenY] = toClient(pt.x, pt.y);
    const dist = Math.hypot(screenX - clientX, screenY - clientY);
    if (dist < minDist) {
      minDist = dist;
    }
  }

  return minDist;
}
