/**
 * SVG normalization, DOM parsing, clean SVG generation, and export pipeline orchestrator.
 */

import type { App } from 'obsidian';
import { ExportOptions, ExportTarget } from './exportTypes';
import {
  isDarkThemeActive,
  resolveThemeBackgroundColor,
  transformSvgForDarkMode,
} from './colorTransforms';
import {
  applyThemeStyling,
  injectSvgBackground,
  injectThemeCssVariables,
  stripEditorOverlays,
} from './svgStyling';
import { convertForeignObjectsToSvgText } from './foreignObjects';

export function normalizeTarget(target: ExportTarget): {
  app?: App;
  code?: string;
  svgMountEl?: HTMLElement | null;
} {
  if (typeof HTMLElement !== 'undefined' && target instanceof HTMLElement) {
    return { svgMountEl: target };
  }
  if (target && typeof target === 'object' && 'nodeType' in target) {
    return { svgMountEl: target as HTMLElement };
  }
  return (target || {}) as {
    app?: App;
    code?: string;
    svgMountEl?: HTMLElement | null;
  };
}

/**
 * Attempts to re-render the Mermaid diagram via Obsidian's native Mermaid API.
 * Uses dynamic import so headless Node.js tests don't fail when 'obsidian' is absent.
 */
export async function tryRenderMermaidSvg(app: App, code: string): Promise<string | null> {
  try {
    const { renderMermaidSvg } = await import('../../renderer/mermaidRenderer');
    return await renderMermaidSvg(app, code);
  } catch (err) {
    console.warn('Merlay: Re-rendering via Mermaid engine failed, using mount element fallback', err);
    return null;
  }
}

/**
 * Parses a raw SVG string into an SVGSVGElement DOM node.
 * Uses text/html first to safely handle unclosed <br> tags in foreignObjects,
 * then falls back to image/svg+xml.
 */
export function parseSvgString(rawSvg: string): SVGSVGElement | null {
  if (!rawSvg) return null;
  if (typeof DOMParser !== 'undefined') {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(rawSvg, 'image/svg+xml');
      const svg = doc.querySelector('svg');
      if (svg) return svg as unknown as SVGSVGElement;
    } catch {
      // Fallback to text/html
    }

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(rawSvg, 'text/html');
      const svg = doc.querySelector('svg');
      if (svg) return svg as unknown as SVGSVGElement;
    } catch {
      // Fallback
    }
  }

  return null;
}

/**
 * Normalizes SVG element dimensions, viewBox, and XML namespace attributes.
 */
export function normalizeExportSvg(
  svg: SVGSVGElement,
  referenceEl?: Element | null
): { width: number; height: number } {
  let width = 0;
  let height = 0;

  const viewBox = svg.getAttribute('viewBox');
  if (viewBox) {
    const parts = viewBox.trim().split(/[\s,]+/).map(parseFloat);
    if (parts.length === 4 && !parts.some(isNaN) && parts[2] > 0 && parts[3] > 0) {
      width = parts[2];
      height = parts[3];
    }
  }

  if (!width) width = parseFloat(svg.getAttribute('width') || '') || (svg as unknown as { clientWidth?: number }).clientWidth || 0;
  if (!height) height = parseFloat(svg.getAttribute('height') || '') || (svg as unknown as { clientHeight?: number }).clientHeight || 0;

  if ((!width || !height) && referenceEl) {
    try {
      const bbox = (referenceEl as unknown as { getBBox?: () => DOMRect }).getBBox?.();
      if (bbox && bbox.width > 0) width = bbox.width;
      if (bbox && bbox.height > 0) height = bbox.height;
    } catch {
      // getBBox might fail in jsdom
    }
  }

  width = Math.ceil(width || 800);
  height = Math.ceil(height || 600);

  svg.setAttribute('width', `${width}`);
  svg.setAttribute('height', `${height}`);
  if (!svg.getAttribute('viewBox')) {
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  }
  const unconstrainedMaxWidth = 'none';
  svg.style.maxWidth = unconstrainedMaxWidth;
  svg.style.width = `${width}px`;
  svg.style.height = `${height}px`;
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  svg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');

  return { width, height };
}

/**
 * Prepares the exported SVG with 100% exact theme fidelity and universal viewer compatibility.
 */
export async function getExportSvgResult(
  targetInput: ExportTarget,
  options: ExportOptions = {}
): Promise<{
  svgString: string;
  width: number;
  height: number;
  svg: SVGSVGElement;
  filter?: string | null;
} | null> {
  const target = normalizeTarget(targetInput);
  let svg: SVGSVGElement | null = null;

  // 1. Primary Engine Path: Re-render clean Mermaid SVG if app & code are available
  if (target.app && target.code) {
    const rawSvgHtml = await tryRenderMermaidSvg(target.app, target.code);
    if (rawSvgHtml) {
      svg = parseSvgString(rawSvgHtml);
    }
  }

  // 2. Fallback Path: Clone live DOM and strip editor-only overlays
  if (!svg && target.svgMountEl) {
    const liveSvg = target.svgMountEl.querySelector('svg');
    if (liveSvg) {
      svg = liveSvg.cloneNode(true) as SVGSVGElement;
      stripEditorOverlays(svg);
    }
  }

  if (!svg && typeof document !== 'undefined') {
    const fallbackEl = document.querySelector('#merlay-svg-mount svg, .mermaid-native-svg-mount svg');
    if (fallbackEl) {
      svg = fallbackEl.cloneNode(true) as SVGSVGElement;
      stripEditorOverlays(svg);
    }
  }

  if (!svg) return null;

  const isDark = isDarkThemeActive();

  // 3. In Dark Mode, mathematically bake Obsidian's theme colors into the SVG markup
  if (isDark) {
    transformSvgForDarkMode(svg);
  }

  // 4. Convert <foreignObject> to native SVG <text> elements so all viewers render text
  convertForeignObjectsToSvgText(svg, isDark);

  // 5. Apply theme fallbacks and ensure edge labels have clean backgrounds
  applyThemeStyling(svg, isDark);

  // 6. Normalize dimensions and viewBox
  const { width, height } = normalizeExportSvg(svg);

  // 7. Inject background if requested
  const resolvedBgColor = options.includeBackground
    ? resolveThemeBackgroundColor(target.svgMountEl, options.backgroundColor)
    : 'transparent';
  if (options.includeBackground) {
    injectSvgBackground(svg, resolvedBgColor, width, height);
  }
  svg.style.backgroundColor = resolvedBgColor;

  // 8. Inject theme CSS variables for standalone viewer compatibility
  injectThemeCssVariables(svg, isDark);

  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(svg);
  return {
    svgString,
    width,
    height,
    svg,
    filter: null,
  };
}

/**
 * Backward-compatible helper to serialize clean SVG.
 */
export function serializeCleanSvg(
  targetInput: ExportTarget,
  options: ExportOptions = {}
): { svgString: string; width: number; height: number } | null {
  const target = normalizeTarget(targetInput);
  if (!target.svgMountEl) return null;

  const liveSvg = target.svgMountEl.querySelector('svg');
  if (!liveSvg) return null;

  const clone = liveSvg.cloneNode(true) as SVGSVGElement;
  stripEditorOverlays(clone);

  const isDark = isDarkThemeActive();
  const { width, height } = normalizeExportSvg(clone, liveSvg);

  const resolvedBgColor = options.includeBackground
    ? resolveThemeBackgroundColor(target.svgMountEl, options.backgroundColor)
    : 'transparent';
  if (options.includeBackground) {
    injectSvgBackground(clone, resolvedBgColor, width, height);
  }
  clone.style.backgroundColor = resolvedBgColor;

  injectThemeCssVariables(clone, isDark);

  const serializer = new XMLSerializer();
  return { svgString: serializer.serializeToString(clone), width, height };
}

/**
 * Backward-compatible helper to get clean SVGSVGElement.
 */
export function getCleanSvgElement(svgMountEl: HTMLElement): {
  svg: SVGSVGElement;
  width: number;
  height: number;
} | null {
  const res = serializeCleanSvg(svgMountEl);
  if (!res) return null;
  const svg = parseSvgString(res.svgString);
  if (!svg) return null;
  return { svg, width: res.width, height: res.height };
}
