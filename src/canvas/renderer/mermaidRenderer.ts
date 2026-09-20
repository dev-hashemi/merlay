/**
 * Pure SVG mount helpers for the canvas.
 *
 * Host-agnostic: rendering Mermaid code to an SVG string is a host
 * responsibility (see `HostAdapter.renderMermaid` and
 * `src/obsidian/obsidianMermaid.ts`). This module only inserts a
 * produced SVG string into the canvas mount element.
 */

import { normalizeSvgDimensions } from './svgDimensions';
import { scrubSvgForMount } from './svgSanitize';
import { clearElement } from '../../platform/dom';

export { normalizeSvgDimensions, scrubSvgForMount };

/**
 * Insert Mermaid-produced SVG into the canvas mount without using innerHTML.
 *
 * Mermaid embeds a <style> block for diagram theming, so instead of going
 * through an HTML sanitizer (which would strip it) the SVG string is parsed
 * into inert nodes and adopted into the live DOM with full fidelity. Script
 * elements and inline event-handler attributes are removed before insertion
 * (Mermaid itself also runs with strict security level).
 *
 * The markup is parsed as HTML (not XML) because Mermaid serializes the SVG
 * the same way innerHTML does — e.g. unclosed <br> inside foreignObject
 * labels — which would fail XML parsing whenever a label wraps.
 */
export function mountMermaidSvg(mountEl: HTMLElement, svgHtml: string): void {
  clearElement(mountEl);

  let svg: SVGSVGElement | null = null;
  try {
    const doc = new DOMParser().parseFromString(svgHtml, 'text/html');
    svg = doc.querySelector<SVGSVGElement>('svg');
  } catch {
    svg = null;
  }

  if (!svg) {
    // Last-resort fallback: XML parse (may lose diagram theming on HTML-serialized markup).
    try {
      const doc = new DOMParser().parseFromString(svgHtml, 'image/svg+xml');
      svg = doc.querySelector<SVGSVGElement>('svg');
    } catch {
      svg = null;
    }
  }

  if (!svg) return;

  scrubSvgForMount(svg);

  normalizeSvgDimensions(svg);

  mountEl.append(document.importNode(svg, true));
}
