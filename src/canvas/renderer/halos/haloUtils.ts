const SVG_SHAPE_SELECTOR = 'rect, circle, polygon, path, ellipse, line';

/**
 * Identifies the geometric SVG elements that represent a node's visual outline.
 * Excludes text, labels, existing halos, and hit areas.
 */
export function findNodeShapeElements(nodeEl: Element): Element[] {
  let shapeElements = Array.from(
    nodeEl.querySelectorAll(SVG_SHAPE_SELECTOR)
  ).filter((el) => {
    if (
      el.closest('.label') ||
      el.closest('text') ||
      el.closest('foreignObject')
    ) {
      return false;
    }
    if (
      el.classList.contains('mermaid-node-selection-halo') ||
      el.classList.contains('mermaid-drop-target-halo') ||
      el.classList.contains('mermaid-lifeline-hit-area')
    ) {
      return false;
    }
    return true;
  });

  // Prefer primary label-container shape(s) if present (except for stick figures where all limbs should glow)
  if (!nodeEl.classList.contains('actor-man') && !nodeEl.querySelector('.actor-man')) {
    const primaryShapes = shapeElements.filter(
      (el) =>
        el.classList.contains('label-container') ||
        el.classList.contains('outer') ||
        el.classList.contains('basic') ||
        el.classList.contains('node-bkg') ||
        el.classList.contains('actor-top') ||
        el.classList.contains('actor-bottom') ||
        el.classList.contains('actor')
    );
    if (primaryShapes.length > 0) {
      shapeElements = primaryShapes;
    }
  }

  // If nodeEl itself is a geometric SVG shape (e.g. <rect class="actor actor-top">)
  if (
    shapeElements.length === 0 &&
    ['rect', 'circle', 'polygon', 'path', 'ellipse', 'line'].includes(
      nodeEl.tagName.toLowerCase()
    )
  ) {
    shapeElements = [nodeEl];
  }

  return shapeElements;
}
