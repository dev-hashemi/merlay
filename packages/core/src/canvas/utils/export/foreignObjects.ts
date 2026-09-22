/**
 * Converts <foreignObject> HTML content to native SVG <text> and <tspan> elements
 * for 100% viewer compatibility across all vector and image tools.
 */

import { isDarkThemeActive } from './colorTransforms';
import { createSvgElement } from '../../../platform/dom';

/**
 * Extracts lines of text from an HTML container, converting <br> and block tags into newlines.
 */
export function extractLinesFromContainer(container: Element): string[] {
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
    return (container.textContent || '')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
  }
}

/**
 * Converts <foreignObject> elements to native SVG <text> elements with <tspan> lines.
 */
export function convertForeignObjectsToSvgText(
  svg: SVGSVGElement,
  isDark: boolean = isDarkThemeActive()
): void {
  const defaultTextColor = isDark ? '#cccccc' : '#333333';
  const fos = Array.from(svg.querySelectorAll('foreignObject'));
  for (const fo of fos) {
    if (!fo || !fo.parentNode) continue;

    const liveContainer =
      fo.querySelector('.nodeLabel, .edgeLabel, div, span, p') || fo;
    let lines = extractLinesFromContainer(liveContainer);
    if (lines.length === 0) {
      const fallback = fo.textContent?.trim();
      if (fallback) {
        lines = [fallback];
      } else {
        fo.remove();
        continue;
      }
    }

    const foX = parseFloat(fo.getAttribute('x') || '0');
    const foY = parseFloat(fo.getAttribute('y') || '0');
    const foW = parseFloat(fo.getAttribute('width') || '0') || 100;
    const foH = parseFloat(fo.getAttribute('height') || '0') || 40;

    const centerX = foX + foW / 2;
    const centerY = foY + foH / 2;

    const textEl = createSvgElement('text');
    textEl.setAttribute('x', String(centerX));
    textEl.setAttribute('y', String(centerY));
    textEl.setAttribute('text-anchor', 'middle');
    textEl.setAttribute('dominant-baseline', 'central');
    textEl.setAttribute('alignment-baseline', 'central');
    textEl.setAttribute(
      'font-family',
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
    );

    // Detect if container or any child has custom color
    let color = defaultTextColor;
    const colorEl =
      fo.querySelector('[style*="color"]') || fo.querySelector('.nodeLabel');
    if (colorEl) {
      const styleAttr = colorEl.getAttribute('style') || '';
      const m = styleAttr.match(/(?:^|;)\s*color\s*:\s*([^;!]+)/i);
      if (m && m[1].trim() && m[1].trim().toLowerCase() !== 'inherit') {
        color = m[1].trim();
      }
    }

    // Check parent node style rule in <style>
    if (color === defaultTextColor) {
      const parentNode = fo.closest('.node, .cluster, [id^="flowchart-"]');
      const nodeId = parentNode?.getAttribute('id');
      if (nodeId) {
        svg.querySelectorAll('style').forEach((styleEl) => {
          const text = styleEl.textContent || '';
          const escapedId = nodeId.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
          const regex = new RegExp(`(?:#|\\.)${escapedId}\\b[^{]*\\{[^}]*?\\bcolor\\s*:\\s*([^;!}\\s]+)`, 'i');
          const m = text.match(regex);
          if (m && m[1].trim() && m[1].trim().toLowerCase() !== 'inherit') {
            color = m[1].trim();
          }
        });
      }
    }

    let fontSize = '14px';
    let fontWeight = '500';
    try {
      const comp = window.getComputedStyle(liveContainer);
      if (comp?.fontSize && parseFloat(comp.fontSize) > 0) fontSize = comp.fontSize;
      if (comp?.fontWeight) fontWeight = comp.fontWeight;
    } catch {
      // ignore
    }

    textEl.setAttribute('fill', color);
    textEl.setAttribute('font-size', fontSize);
    textEl.setAttribute('font-weight', fontWeight);

    if (lines.length <= 1) {
      textEl.textContent = lines[0] || '';
    } else {
      const fontSizeNum = parseFloat(fontSize) || 14;
      const lineHeight = fontSizeNum * 1.25;
      const totalH = (lines.length - 1) * lineHeight;
      const startY = centerY - totalH / 2;

      lines.forEach((line, idx) => {
        const tspan = createSvgElement('tspan');
        tspan.textContent = line;
        tspan.setAttribute('x', String(centerX));
        tspan.setAttribute('y', String(startY + idx * lineHeight));
        tspan.setAttribute('text-anchor', 'middle');
        tspan.setAttribute('dominant-baseline', 'central');
        tspan.setAttribute('alignment-baseline', 'central');
        tspan.setAttribute('fill', color);
        textEl.appendChild(tspan);
      });
    }

    fo.parentNode.replaceChild(textEl, fo);
  }
}
