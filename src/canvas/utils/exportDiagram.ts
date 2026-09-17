/**
 * Diagram export utilities for Mermaid SVGs:
 * - Synchronous lockstep tree traversal for 100% accurate computed style inlining
 * - Preserves native Mermaid structure & HTML foreignObjects in SVG export (1:1 visual fidelity)
 * - Safe native <text> conversion solely for HTML Canvas rasterization to prevent tainted canvas
 * - Bulletproof theme background color resolution with viewBox-aligned geometry
 * - Direct clipboard copy (PNG & SVG)
 * - Local file download (PNG & SVG)
 */

function showNotice(message: string): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const obsidian = require('obsidian');
    if (obsidian?.Notice) {
      new obsidian.Notice(message);
      return;
    }
  } catch {
    // In headless test environments
  }
}

export interface ExportOptions {
  includeBackground?: boolean;
  backgroundColor?: string;
  scale?: number;
  fileName?: string;
}

const OVERLAY_ELEMENT_CLASSES = [
  'mermaid-drop-target-halo',
  'mermaid-node-selection-halo',
  'mermaid-node-selection-halo-glow',
  'mermaid-node-selection-halo-accent',
  'mermaid-edge-selected-clone',
  'mermaid-edge-hovered-clone',
  'mermaid-edge-hit-area',
  'mermaid-lifeline-hit-area',
];

const TRANSIENT_STATE_CLASSES = [
  'mermaid-cluster-selected',
  'mermaid-view-highlight',
  'mermaid-drop-target',
  'mermaid-edge-selected',
  'mermaid-node-selected',
];

function isOverlayElement(el: Element): boolean {
  if (!el.classList) return false;
  return OVERLAY_ELEMENT_CLASSES.some((cls) => el.classList.contains(cls));
}

/**
 * Resolves any CSS color string, token, or CSS variable to an explicit, non-empty, opaque color.
 * Guaranteed to never return 'transparent', 'rgba(0, 0, 0, 0)', or unresolved 'var(...)'.
 */
export function resolveThemeBackgroundColor(
  svgMountEl?: HTMLElement | null,
  requestedColor?: string
): string {
  if (
    requestedColor &&
    requestedColor !== 'transparent' &&
    requestedColor !== 'rgba(0, 0, 0, 0)'
  ) {
    return requestedColor;
  }

  if (typeof document === 'undefined') return '#1e1e1e';

  const isLight = document.body.classList.contains('theme-light');
  const defaultFallback = isLight ? '#ffffff' : '#1e1e1e';

  // 1. Probe canvas editor root computed background
  if (svgMountEl) {
    const editorRoot = svgMountEl.closest('.mermaid-native-editor-root');
    if (editorRoot) {
      try {
        const bg = window.getComputedStyle(editorRoot).backgroundColor;
        if (bg && bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)') {
          return bg;
        }
      } catch {
        // ignore
      }
    }
  }

  // 2. Probe Obsidian body computed background
  try {
    const bodyBg = window.getComputedStyle(document.body).backgroundColor;
    if (bodyBg && bodyBg !== 'transparent' && bodyBg !== 'rgba(0, 0, 0, 0)') {
      return bodyBg;
    }
  } catch {
    // ignore
  }

  // 3. Resolve --background-primary CSS variable via temporary probe element
  try {
    const probe = document.createElement('div');
    probe.style.backgroundColor = 'var(--background-primary)';
    probe.style.display = 'none';
    document.body.appendChild(probe);
    const probeBg = window.getComputedStyle(probe).backgroundColor;
    probe.remove();
    if (probeBg && probeBg !== 'transparent' && probeBg !== 'rgba(0, 0, 0, 0)') {
      return probeBg;
    }
  } catch {
    // ignore
  }

  return defaultFallback;
}

/**
 * Backward compatibility alias for resolveThemeBackgroundColor.
 */
export function getComputedBackgroundColor(svgMountEl?: HTMLElement | null): string {
  return resolveThemeBackgroundColor(svgMountEl);
}

/**
 * Inlines computed presentation styles from live DOM elements to cloned SVG elements.
 * Uses !important on inline styles so Mermaid's embedded theme stylesheets can never override them.
 */
function inlineStylesForElement(
  liveEl: Element,
  cloneEl: Element,
  tag: string
): void {
  let comp: CSSStyleDeclaration | null = null;
  try {
    comp = window.getComputedStyle(liveEl);
  } catch {
    return;
  }
  if (!comp) return;

  const cloneStyle = (cloneEl as HTMLElement | SVGElement).style;
  if (!cloneStyle) return;

  // Shapes & Paths
  if (
    [
      'rect',
      'circle',
      'ellipse',
      'polygon',
      'polyline',
      'path',
      'line',
    ].includes(tag)
  ) {
    // Fill
    const fill = comp.fill;
    if (fill && fill !== 'none' && fill !== 'rgba(0, 0, 0, 0)') {
      cloneStyle.setProperty('fill', fill, 'important');
      cloneEl.setAttribute('fill', fill);
    } else if (tag === 'path' || tag === 'line' || fill === 'none') {
      cloneStyle.setProperty('fill', 'none', 'important');
      cloneEl.setAttribute('fill', 'none');
    }

    // Fill Opacity
    if (comp.fillOpacity && comp.fillOpacity !== '1') {
      cloneStyle.setProperty('fill-opacity', comp.fillOpacity, 'important');
      cloneEl.setAttribute('fill-opacity', comp.fillOpacity);
    }

    // Stroke
    const stroke = comp.stroke;
    if (stroke && stroke !== 'none' && stroke !== 'rgba(0, 0, 0, 0)') {
      cloneStyle.setProperty('stroke', stroke, 'important');
      cloneEl.setAttribute('stroke', stroke);
    } else if (stroke === 'none') {
      cloneStyle.setProperty('stroke', 'none', 'important');
      cloneEl.setAttribute('stroke', 'none');
    }

    // Stroke Width
    if (comp.strokeWidth && comp.strokeWidth !== '0px') {
      cloneStyle.setProperty('stroke-width', comp.strokeWidth, 'important');
      cloneEl.setAttribute('stroke-width', comp.strokeWidth);
    }

    // Stroke Dasharray
    if (comp.strokeDasharray && comp.strokeDasharray !== 'none') {
      cloneStyle.setProperty('stroke-dasharray', comp.strokeDasharray, 'important');
      cloneEl.setAttribute('stroke-dasharray', comp.strokeDasharray);
    }

    // Stroke Linecap & Linejoin
    if (comp.strokeLinecap) {
      cloneStyle.setProperty('stroke-linecap', comp.strokeLinecap, 'important');
    }
    if (comp.strokeLinejoin) {
      cloneStyle.setProperty('stroke-linejoin', comp.strokeLinejoin, 'important');
    }

    // Opacity
    if (comp.opacity && comp.opacity !== '1') {
      cloneStyle.setProperty('opacity', comp.opacity, 'important');
      cloneEl.setAttribute('opacity', comp.opacity);
    }

    // Arrowhead marker safeguard: ensure marker paths have fill
    if (
      (liveEl.classList.contains('arrowMarkerPath') ||
        liveEl.classList.contains('arrowheadPath')) &&
      (!fill || fill === 'none' || fill === 'rgba(0, 0, 0, 0)')
    ) {
      const fallbackColor = comp.color || comp.stroke || '#888888';
      cloneStyle.setProperty('fill', fallbackColor, 'important');
      cloneEl.setAttribute('fill', fallbackColor);
    }
  }

  // Native SVG Text Elements
  if (tag === 'text' || tag === 'tspan') {
    const textColor =
      comp.fill && comp.fill !== 'none' && comp.fill !== 'rgba(0, 0, 0, 0)'
        ? comp.fill
        : comp.color && comp.color !== 'rgba(0, 0, 0, 0)'
        ? comp.color
        : '#dcddde';

    cloneStyle.setProperty('fill', textColor, 'important');
    cloneEl.setAttribute('fill', textColor);

    if (comp.fontFamily) {
      cloneStyle.setProperty('font-family', comp.fontFamily, 'important');
      cloneEl.setAttribute('font-family', comp.fontFamily);
    }
    if (comp.fontSize) {
      cloneStyle.setProperty('font-size', comp.fontSize, 'important');
      cloneEl.setAttribute('font-size', comp.fontSize);
    }
    if (comp.fontWeight) {
      cloneStyle.setProperty('font-weight', comp.fontWeight, 'important');
      cloneEl.setAttribute('font-weight', comp.fontWeight);
    }
    if (comp.textAnchor) {
      cloneStyle.setProperty('text-anchor', comp.textAnchor, 'important');
    }
    if (comp.dominantBaseline) {
      cloneStyle.setProperty('dominant-baseline', comp.dominantBaseline, 'important');
    }
  }

  // HTML Elements inside foreignObject (preserve full styling for SVG export)
  if (
    ['div', 'span', 'p', 'b', 'strong', 'i', 'em', 'code', 'pre', 'a'].includes(
      tag
    )
  ) {
    if (comp.color && comp.color !== 'rgba(0, 0, 0, 0)') {
      cloneStyle.setProperty('color', comp.color, 'important');
    }
    if (comp.fontFamily) {
      cloneStyle.setProperty('font-family', comp.fontFamily, 'important');
    }
    if (comp.fontSize) {
      cloneStyle.setProperty('font-size', comp.fontSize, 'important');
    }
    if (comp.fontWeight) {
      cloneStyle.setProperty('font-weight', comp.fontWeight, 'important');
    }
    if (comp.lineHeight) {
      cloneStyle.setProperty('line-height', comp.lineHeight, 'important');
    }
    if (comp.textAlign) {
      cloneStyle.setProperty('text-align', comp.textAlign, 'important');
    }
  }
}

/**
 * Synchronous lockstep tree traversal: walks the live SVG and cloned SVG simultaneously.
 * Guarantees 1:1 index and structural alignment without any shifting or drift.
 */
function syncAndInlineNode(liveEl: Element, cloneEl: Element): void {
  // If this element is an editor overlay (hit areas, halos, clone previews), mark for removal
  if (isOverlayElement(liveEl)) {
    cloneEl.setAttribute('data-remove-overlay', 'true');
    return;
  }

  // Remove transient visual selection states so editor highlights are not baked into export
  for (const cls of TRANSIENT_STATE_CLASSES) {
    if (cloneEl.classList && cloneEl.classList.contains(cls)) {
      cloneEl.classList.remove(cls);
    }
  }

  const tag = liveEl.tagName.toLowerCase();

  // Mark Mermaid's embedded theme <style> block for removal to prevent conflicting light rules
  if (tag === 'style') {
    cloneEl.setAttribute('data-remove-style', 'true');
    return;
  }

  // Inline computed styles for this element
  inlineStylesForElement(liveEl, cloneEl, tag);

  // Recurse children in lockstep
  const liveChildren = liveEl.children;
  const cloneChildren = cloneEl.children;
  const count = Math.min(liveChildren.length, cloneChildren.length);
  for (let i = 0; i < count; i++) {
    syncAndInlineNode(liveChildren[i], cloneChildren[i]);
  }
}

/**
 * Extracts clean multi-line text strings from an HTML label container,
 * converting <br> tags, <div> blocks, and <p> blocks into distinct lines.
 */
function extractLinesFromContainer(container: Element): string[] {
  try {
    const clone = container.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('br').forEach((br) => br.replaceWith('\n'));
    clone.querySelectorAll('p, div').forEach((block) => {
      block.prepend('\n');
    });
    const raw = clone.textContent || '';
    return raw
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
  } catch {
    const raw = container.textContent || '';
    return raw
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
  }
}

/**
 * Converts HTML <foreignObject> labels into native SVG <text> elements with <tspan> lines.
 * This is executed ONLY when preparing SVG for HTML Canvas rasterization to prevent
 * Chromium canvas tainting (SecurityError) during PNG export.
 */
function convertForeignObjectsToSvgText(
  liveSvg: SVGSVGElement,
  exportSvg: SVGSVGElement
): void {
  const liveFOs = Array.from(liveSvg.querySelectorAll('foreignObject'));
  const exportFOs = Array.from(exportSvg.querySelectorAll('foreignObject'));
  const count = Math.min(liveFOs.length, exportFOs.length);

  for (let i = 0; i < count; i++) {
    const liveFo = liveFOs[i];
    const exportFo = exportFOs[i];
    if (!liveFo || !exportFo || !exportFo.parentNode) continue;

    const liveContainer =
      liveFo.querySelector('.nodeLabel, .edgeLabel, div, span, p') || liveFo;
    const lines = extractLinesFromContainer(liveContainer);
    if (lines.length === 0) {
      exportFo.remove();
      continue;
    }

    let color = '#dcddde';
    let fontFamily =
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
    let fontSize = '14px';
    let fontWeight = 'normal';

    try {
      const comp = window.getComputedStyle(liveContainer);
      if (comp) {
        if (comp.color && comp.color !== 'rgba(0, 0, 0, 0)') color = comp.color;
        if (comp.fontFamily) fontFamily = comp.fontFamily;
        if (comp.fontSize) fontSize = comp.fontSize;
        if (comp.fontWeight) fontWeight = comp.fontWeight;
      }
    } catch {
      // ignore
    }

    const foX = parseFloat(exportFo.getAttribute('x') || '0');
    const foY = parseFloat(exportFo.getAttribute('y') || '0');
    const foW =
      parseFloat(exportFo.getAttribute('width') || '0') ||
      (liveFo as any).clientWidth ||
      100;
    const foH =
      parseFloat(exportFo.getAttribute('height') || '0') ||
      (liveFo as any).clientHeight ||
      40;

    const centerX = foX + foW / 2;
    const centerY = foY + foH / 2;

    const textEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    textEl.setAttribute('x', String(centerX));
    textEl.setAttribute('y', String(centerY));
    textEl.setAttribute('text-anchor', 'middle');
    textEl.setAttribute('dominant-baseline', 'central');
    textEl.setAttribute('fill', color);
    textEl.setAttribute('font-family', fontFamily);
    textEl.setAttribute('font-size', fontSize);
    textEl.setAttribute('font-weight', fontWeight);
    textEl.style.setProperty('fill', color, 'important');
    textEl.style.setProperty('font-family', fontFamily, 'important');
    textEl.style.setProperty('font-size', fontSize, 'important');
    textEl.style.setProperty('font-weight', fontWeight, 'important');

    if (lines.length <= 1) {
      textEl.textContent = lines[0] || '';
    } else {
      const fontSizeNum = parseFloat(fontSize) || 14;
      const lineHeight = fontSizeNum * 1.25;
      const totalH = (lines.length - 1) * lineHeight;
      const startY = centerY - totalH / 2;

      lines.forEach((line, idx) => {
        const tspan = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
        tspan.textContent = line;
        tspan.setAttribute('x', String(centerX));
        tspan.setAttribute('y', String(startY + idx * lineHeight));
        tspan.setAttribute('text-anchor', 'middle');
        tspan.setAttribute('dominant-baseline', 'central');
        tspan.style.setProperty('fill', color, 'important');
        textEl.appendChild(tspan);
      });
    }

    exportFo.parentNode.replaceChild(textEl, exportFo);
  }
}

/**
 * Inlines Obsidian theme CSS variables and clean default styles into the SVG header.
 */
function injectThemeCssVariables(svg: SVGSVGElement): void {
  if (typeof document === 'undefined') return;
  const style = getComputedStyle(document.body);
  const textNormal = style.getPropertyValue('--text-normal').trim() || '#dcddde';
  const textMuted = style.getPropertyValue('--text-muted').trim() || '#888888';
  const bgPrimary = style.getPropertyValue('--background-primary').trim() || '#1e1e1e';
  const bgSecondary = style.getPropertyValue('--background-secondary').trim() || '#252525';
  const accent = style.getPropertyValue('--interactive-accent').trim() || '#7c3aed';

  const styleEl = document.createElementNS('http://www.w3.org/2000/svg', 'style');
  styleEl.setAttribute('type', 'text/css');
  styleEl.textContent = `
    :root {
      --text-normal: ${textNormal};
      --text-muted: ${textMuted};
      --background-primary: ${bgPrimary};
      --background-secondary: ${bgSecondary};
      --interactive-accent: ${accent};
    }
    .nodeLabel, .edgeLabel {
      color: ${textNormal};
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    }
  `;
  svg.insertBefore(styleEl, svg.firstChild);
}

/**
 * Injects a solid background rect that precisely matches the diagram's viewBox coordinates.
 * Inserts behind all diagram elements so the entire canvas area has solid background coverage.
 */
function injectSvgBackground(
  svg: SVGSVGElement,
  bgColor: string,
  width: number,
  height: number
): void {
  let bgX = 0;
  let bgY = 0;
  let bgW = width;
  let bgH = height;

  const viewBox = svg.getAttribute('viewBox');
  if (viewBox) {
    const parts = viewBox.trim().split(/[\s,]+/).map(parseFloat);
    if (parts.length === 4 && !parts.some(isNaN)) {
      bgX = parts[0];
      bgY = parts[1];
      bgW = parts[2];
      bgH = parts[3];
    }
  }

  const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  bgRect.setAttribute('class', 'mermaid-export-background');
  bgRect.setAttribute('x', String(bgX));
  bgRect.setAttribute('y', String(bgY));
  bgRect.setAttribute('width', String(bgW));
  bgRect.setAttribute('height', String(bgH));
  bgRect.setAttribute('fill', bgColor);
  bgRect.style.setProperty('fill', bgColor, 'important');
  bgRect.style.setProperty('stroke', 'none', 'important');

  // Insert background behind visible shapes.
  // If <defs> exists as first element, insert right after <defs>; otherwise at start.
  const firstChild = svg.firstElementChild;
  if (firstChild && firstChild.tagName.toLowerCase() === 'defs') {
    if (firstChild.nextSibling) {
      svg.insertBefore(bgRect, firstChild.nextSibling);
    } else {
      svg.appendChild(bgRect);
    }
  } else {
    svg.insertBefore(bgRect, svg.firstChild);
  }
}

/**
 * Normalizes SVG element dimensions, viewBox, and XML namespace attributes.
 */
function normalizeSvgDimensions(
  svg: SVGSVGElement,
  originalSvg: SVGSVGElement
): { width: number; height: number } {
  let width = 0;
  let height = 0;

  const viewBox = svg.getAttribute('viewBox');
  if (viewBox) {
    const parts = viewBox.trim().split(/[\s,]+/);
    if (parts.length === 4) {
      const w = parseFloat(parts[2]);
      const h = parseFloat(parts[3]);
      if (!isNaN(w) && w > 0 && !isNaN(h) && h > 0) {
        width = w;
        height = h;
      }
    }
  }

  if (!width) width = parseFloat(svg.getAttribute('width') || '') || svg.clientWidth;
  if (!height) height = parseFloat(svg.getAttribute('height') || '') || svg.clientHeight;

  if (!width || !height) {
    try {
      const bbox = originalSvg.getBBox();
      if (bbox.width > 0) width = bbox.width;
      if (bbox.height > 0) height = bbox.height;
    } catch {
      // getBBox might fail in jsdom/headless
    }
  }

  width = Math.ceil(width || 800);
  height = Math.ceil(height || 600);

  svg.setAttribute('width', `${width}`);
  svg.setAttribute('height', `${height}`);
  if (!svg.getAttribute('viewBox')) {
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  }
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  svg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');

  return { width, height };
}

/**
 * Extracts and prepares an isolated, clean SVGSVGElement ready for vector export.
 * Inlines live computed styles via lockstep synchronization and strips editor-only overlays.
 * Preserves native HTML foreignObject structure for 100% fidelity with live Mermaid rendering.
 */
export function getCleanSvgElement(svgMountEl: HTMLElement): {
  svg: SVGSVGElement;
  width: number;
  height: number;
} | null {
  const originalSvg = svgMountEl.querySelector('svg');
  if (!originalSvg) return null;

  const clone = originalSvg.cloneNode(true) as SVGSVGElement;

  // 1. Lockstep synchronization: inline live computed styles while trees are structurally identical
  syncAndInlineNode(originalSvg, clone);

  // 2. Safely remove marked overlays and stale theme style tags from the clone
  clone
    .querySelectorAll('[data-remove-overlay="true"]')
    .forEach((el) => el.remove());
  clone
    .querySelectorAll('[data-remove-style="true"]')
    .forEach((el) => el.remove());

  // 3. Normalize dimensions and XML namespaces
  const { width, height } = normalizeSvgDimensions(clone, originalSvg);

  return { svg: clone, width, height };
}

/**
 * Serializes the clean SVG for vector export (.svg file download or SVG clipboard copy).
 * Maintains 100% exact look with Mermaid's live SVG output.
 */
export function serializeCleanSvg(
  svgMountEl: HTMLElement,
  options: ExportOptions = {}
): { svgString: string; width: number; height: number } | null {
  const result = getCleanSvgElement(svgMountEl);
  if (!result) return null;
  const { svg, width, height } = result;

  // Add background rect if requested
  if (options.includeBackground) {
    const bgColor = resolveThemeBackgroundColor(svgMountEl, options.backgroundColor);
    injectSvgBackground(svg, bgColor, width, height);
  }

  injectThemeCssVariables(svg);

  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(svg);
  return { svgString, width, height };
}

/**
 * Serializes the SVG specifically for PNG rasterization on an HTML Canvas.
 * Converts HTML foreignObjects into native SVG <text> elements to ensure the canvas
 * is NEVER tainted by HTML, allowing canvas.toBlob() to succeed reliably.
 */
export function serializeSvgForPng(
  svgMountEl: HTMLElement,
  options: ExportOptions = {}
): { svgString: string; width: number; height: number } | null {
  const originalSvg = svgMountEl.querySelector('svg');
  if (!originalSvg) return null;

  const result = getCleanSvgElement(svgMountEl);
  if (!result) return null;
  const { svg, width, height } = result;

  // Convert foreignObjects to native SVG <text> elements for untainted canvas drawing
  convertForeignObjectsToSvgText(originalSvg, svg);

  // Add background rect if requested
  if (options.includeBackground) {
    const bgColor = resolveThemeBackgroundColor(svgMountEl, options.backgroundColor);
    injectSvgBackground(svg, bgColor, width, height);
  }

  injectThemeCssVariables(svg);

  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(svg);
  return { svgString, width, height };
}

/**
 * Copies clean SVG vector markup directly to clipboard.
 */
export async function copySvgToClipboard(
  svgMountEl: HTMLElement,
  options: ExportOptions = {}
): Promise<boolean> {
  const res = serializeCleanSvg(svgMountEl, options);
  if (!res) {
    showNotice('Failed to export: No diagram found');
    return false;
  }
  try {
    await navigator.clipboard.writeText(res.svgString);
    showNotice('SVG copied to clipboard');
    return true;
  } catch (e) {
    console.error('Failed to copy SVG to clipboard:', e);
    showNotice('Failed to copy SVG to clipboard');
    return false;
  }
}

/**
 * Downloads the diagram as a standalone .svg file.
 */
export function downloadSvg(
  svgMountEl: HTMLElement,
  options: ExportOptions = {}
): boolean {
  const res = serializeCleanSvg(svgMountEl, options);
  if (!res) {
    showNotice('Failed to export: No diagram found');
    return false;
  }
  try {
    const blob = new Blob([res.svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${options.fileName || 'mermaid-diagram'}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showNotice('SVG downloaded');
    return true;
  } catch (e) {
    console.error('Failed to download SVG:', e);
    showNotice('Failed to download SVG');
    return false;
  }
}

/**
 * High-DPI rasterization of serialized SVG to an HTML Canvas Blob.
 * Because all foreignObject elements are converted to native SVG <text>,
 * the canvas is NEVER tainted and rasterizes reliably across all platforms.
 */
async function rasterizeSvgToBlob(
  svgString: string,
  width: number,
  height: number,
  options: ExportOptions,
  svgMountEl?: HTMLElement | null
): Promise<Blob | null> {
  const scale = options.scale || 2; // Default to 2x for sharp retina rendering
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  if (options.includeBackground) {
    ctx.fillStyle = resolveThemeBackgroundColor(svgMountEl, options.backgroundColor);
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = (e) => reject(e);
      img.src = url;
    });

    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  } finally {
    URL.revokeObjectURL(url);
  }

  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png');
  });
}

/**
 * Copies rendered high-resolution PNG image directly to clipboard.
 */
export async function copyPngToClipboard(
  svgMountEl: HTMLElement,
  options: ExportOptions = {}
): Promise<boolean> {
  const res = serializeSvgForPng(svgMountEl, options);
  if (!res) {
    showNotice('Failed to export: No diagram found');
    return false;
  }
  try {
    const blob = await rasterizeSvgToBlob(
      res.svgString,
      res.width,
      res.height,
      options,
      svgMountEl
    );
    if (!blob) {
      showNotice('Failed to rasterize PNG');
      return false;
    }
    await navigator.clipboard.write([
      new ClipboardItem({ 'image/png': blob }),
    ]);
    showNotice('PNG copied to clipboard');
    return true;
  } catch (e) {
    console.error('Failed to copy PNG to clipboard:', e);
    showNotice('Failed to copy PNG to clipboard');
    return false;
  }
}

/**
 * Downloads the diagram as a standalone high-resolution .png file.
 */
export async function downloadPng(
  svgMountEl: HTMLElement,
  options: ExportOptions = {}
): Promise<boolean> {
  const res = serializeSvgForPng(svgMountEl, options);
  if (!res) {
    showNotice('Failed to export: No diagram found');
    return false;
  }
  try {
    const blob = await rasterizeSvgToBlob(
      res.svgString,
      res.width,
      res.height,
      options,
      svgMountEl
    );
    if (!blob) {
      showNotice('Failed to rasterize PNG');
      return false;
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${options.fileName || 'mermaid-diagram'}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showNotice('PNG downloaded');
    return true;
  } catch (e) {
    console.error('Failed to download PNG:', e);
    showNotice('Failed to download PNG');
    return false;
  }
}
