/**
 * Normalizes SVG dimensions so diagrams render at their true 1:1 natural scale
 * rather than being shrunk or constrained by container width, viewport width, or
 * host responsive `max-width: 100%` stylesheet rules.
 */
import { applyStyles } from '../../platform/dom';

export function normalizeSvgDimensions(svg: SVGSVGElement): void {
  let naturalWidth: number | null = null;
  let naturalHeight: number | null = null;

  const viewBox = svg.getAttribute('viewBox');
  if (viewBox) {
    const parts = viewBox.trim().split(/[\s,]+/);
    if (parts.length === 4) {
      const w = parseFloat(parts[2]);
      const h = parseFloat(parts[3]);
      if (!isNaN(w) && w > 0 && !isNaN(h) && h > 0) {
        naturalWidth = w;
        naturalHeight = h;
      }
    }
  }

  if (naturalWidth === null && svg.style.maxWidth) {
    const parsed = parseFloat(svg.style.maxWidth);
    if (!isNaN(parsed) && parsed > 0) {
      naturalWidth = parsed;
    }
  }

  if (naturalHeight === null) {
    if (svg.style.maxHeight) {
      const parsedH = parseFloat(svg.style.maxHeight);
      if (!isNaN(parsedH) && parsedH > 0) naturalHeight = parsedH;
    } else if (svg.hasAttribute('height') && !svg.getAttribute('height')?.includes('%')) {
      const parsedH = parseFloat(svg.getAttribute('height') || '');
      if (!isNaN(parsedH) && parsedH > 0) naturalHeight = parsedH;
    }
  }

  // Dynamic pixel dimensions cannot be expressed as static CSS classes, so they
  // are applied as inline styles (plain inline styles already beat
  // non-important stylesheet rules). The max-width override against
  // host responsive constraints lives in styles.css
  // (#merlay-svg-mount.mermaid-native-svg-mount svg).
  const inlineStyles: Partial<CSSStyleDeclaration> = {};
  if (naturalWidth !== null) {
    svg.setAttribute('width', `${naturalWidth}`);
    inlineStyles.width = `${naturalWidth}px`;
    inlineStyles.minWidth = `${naturalWidth}px`;
  }
  if (naturalHeight !== null) {
    svg.setAttribute('height', `${naturalHeight}`);
    inlineStyles.height = `${naturalHeight}px`;
    inlineStyles.minHeight = `${naturalHeight}px`;
  }
  inlineStyles.maxWidth = 'none';
  applyStyles(svg, inlineStyles);
}
