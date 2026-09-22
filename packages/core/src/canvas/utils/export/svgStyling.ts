/**
 * SVG Presentation, Theme Styling, Markers, and Background Injection for export.
 */

import { createSvgElement } from '../../../platform/dom';

export function injectThemeCssVariables(svg: SVGSVGElement, isDark: boolean = true): void {
  if (typeof document === 'undefined') return;
  const textNormal = isDark ? '#f1f5f9' : '#1e293b';
  const textMuted = isDark ? '#94a3b8' : '#64748b';
  const bgPrimary = isDark ? '#1e1e1e' : '#ffffff';
  const bgSecondary = isDark ? '#252525' : '#f8fafc';
  const accent = '#7c3aed';

  const styleEl = createSvgElement('style');
  styleEl.setAttribute('type', 'text/css');
  styleEl.textContent = `
    :root {
      --text-normal: ${textNormal};
      --text-muted: ${textMuted};
      --background-primary: ${bgPrimary};
      --background-secondary: ${bgSecondary};
      --interactive-accent: ${accent};
    }
    text, tspan {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    }
  `;
  svg.insertBefore(styleEl, svg.firstChild);
}

/**
 * Strips Merlay-specific editor overlays from an SVG clone.
 */
export function stripEditorOverlays(svg: SVGSVGElement): void {
  svg
    .querySelectorAll(
      '.mermaid-edge-hit-area, .mermaid-lifeline-hit-area, .mermaid-node-selection-halo, .mermaid-drop-target-halo, .mermaid-edge-selected-clone, .mermaid-edge-hovered-clone'
    )
    .forEach((el) => el.remove());

  const transientClasses = [
    'mermaid-cluster-selected',
    'mermaid-view-highlight',
    'mermaid-drop-target',
    'mermaid-drop-blocked',
    'mermaid-edge-selected',
    'mermaid-node-selected',
  ];
  transientClasses.forEach((cls) => {
    svg.querySelectorAll(`.${cls}`).forEach((el) => el.classList.remove(cls));
  });
}

import {
  findMarkerById,
  getMarkerIdFromElement,
  getExplicitStrokeColor,
  applyMarkerColor,
  applyEdgeAndMarkerStyling,
} from './svgMarkerStyling';
import { styleSequenceElements } from './svgSequenceStyling';

export {
  findMarkerById,
  getMarkerIdFromElement,
  getExplicitStrokeColor,
  applyMarkerColor,
  applyEdgeAndMarkerStyling,
  styleSequenceElements,
};

/**
 * Applies theme-aware styles (dark or light) to default Mermaid elements
 * and inlines universal presentation attributes on edges and markers.
 */
export function applyThemeStyling(svg: SVGSVGElement, isDark: boolean): void {
  const defaultTextColor = isDark ? '#cccccc' : '#333333';
  const defaultArrowColor = isDark ? '#cccccc' : '#333333';
  const defaultNodeFill = isDark ? '#101028' : '#ECECFF';
  const defaultNodeStroke = isDark ? '#996df3' : '#9370DB';
  const defaultClusterFill = isDark ? '#000021' : 'rgba(241, 245, 249, 0.7)';
  const defaultClusterStroke = isDark ? '#5555cc' : '#cbd5e1';

  // 1. Ensure <defs> exists at the top of the SVG and contains all <marker> elements
  let defs = svg.querySelector('defs');
  if (!defs) {
    defs = createSvgElement('defs');
    const firstChild = svg.firstElementChild;
    if (firstChild) {
      svg.insertBefore(defs, firstChild);
    } else {
      svg.appendChild(defs);
    }
  }

  svg.querySelectorAll('marker').forEach((marker) => {
    if ((marker.parentElement as Element | null) !== (defs as Element | null)) {
      defs.appendChild(marker);
    }
  });

  // Ensure all markers use orient="auto" instead of orient="auto-start-reverse"
  svg.querySelectorAll('marker[orient="auto-start-reverse"]').forEach((marker) => {
    marker.setAttribute('orient', 'auto');
  });

  applyEdgeAndMarkerStyling(svg, defs, defaultArrowColor);

  // Sequence diagram theme parity
  const defaultActorFill = isDark ? '#101028' : '#ECECFF';
  const defaultActorStroke = isDark ? '#996df3' : '#9370DB';
  styleSequenceElements(svg, isDark, defaultActorFill, defaultActorStroke);

  svg.querySelectorAll('marker').forEach((marker) => {
    const existingFill = marker.getAttribute('fill');
    const existingStroke = marker.getAttribute('stroke');
    const color = existingFill || existingStroke || defaultArrowColor;
    applyMarkerColor(marker, color);
  });

  svg
    .querySelectorAll(
      '.node rect, .node circle, .node polygon, .node ellipse, .node path, .actor rect, .actor circle, .actor line'
    )
    .forEach((shape) => {
      if (
        shape.closest('.label') ||
        shape.closest('.actor-man') ||
        shape.classList.contains('actor-line') ||
        shape.classList.contains('mermaid-node-selection-halo') ||
        shape.classList.contains('mermaid-drop-target-halo') ||
        shape.classList.contains('mermaid-lifeline-hit-area') ||
        shape.classList.contains('mermaid-export-background') ||
        shape.closest('marker') ||
        shape.closest('defs')
      ) {
        return;
      }
      const shapeStyle = shape.getAttribute('style') || '';
      const parentNode = shape.closest('.node, .actor');
      const parentStyle = parentNode?.getAttribute('style') || '';

      const hasFill =
        shapeStyle.includes('fill') ||
        parentStyle.includes('fill') ||
        (shape.getAttribute('fill') && shape.getAttribute('fill') !== 'none');

      if (!hasFill) {
        shape.setAttribute('fill', defaultNodeFill);
      }

      const hasStroke =
        shapeStyle.includes('stroke') ||
        parentStyle.includes('stroke') ||
        (shape.getAttribute('stroke') && shape.getAttribute('stroke') !== 'none');

      if (!hasStroke) {
        shape.setAttribute('stroke', defaultNodeStroke);
        if (!shape.getAttribute('stroke-width')) {
          shape.setAttribute('stroke-width', '1.5');
        }
      }
    });

  svg.querySelectorAll('.cluster rect, .subgraph rect').forEach((clusterRect) => {
    const styleAttr = clusterRect.getAttribute('style') || '';
    if (!styleAttr.includes('fill') && !clusterRect.getAttribute('fill')) {
      clusterRect.setAttribute('fill', defaultClusterFill);
    }
    if (!styleAttr.includes('stroke') && !clusterRect.getAttribute('stroke')) {
      clusterRect.setAttribute('stroke', defaultClusterStroke);
      clusterRect.setAttribute('stroke-width', '1.5');
    }
  });

  svg.querySelectorAll('.edgeLabel rect, .labelBkg').forEach((bkg) => {
    bkg.setAttribute('fill', isDark ? '#1e1e1e' : '#ffffff');
  });

  svg.querySelectorAll('text, tspan').forEach((textEl) => {
    if (textEl.classList.contains('sequenceNumber') || textEl.closest('.sequenceNumber')) {
      return;
    }
    if (textEl.classList.contains('actor') || textEl.closest('.actor-box') || textEl.closest('.actor')) {
      if (!textEl.getAttribute('style')?.includes('fill') && !textEl.getAttribute('fill')) {
        textEl.setAttribute('fill', isDark ? '#ffffff' : '#333333');
      }
      return;
    }
    if (!textEl.getAttribute('style')?.includes('fill') && !textEl.getAttribute('fill')) {
      textEl.setAttribute('fill', defaultTextColor);
    }
  });
}

/**
 * Injects a solid background rect covering the diagram's exact viewBox coordinates.
 */
export function injectSvgBackground(
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

  const bgRect = createSvgElement('rect');
  bgRect.setAttribute('class', 'mermaid-export-background');
  bgRect.setAttribute('x', String(bgX));
  bgRect.setAttribute('y', String(bgY));
  bgRect.setAttribute('width', String(bgW));
  bgRect.setAttribute('height', String(bgH));
  bgRect.setAttribute('fill', bgColor);
  bgRect.setAttribute('stroke', 'none');

  const firstVisibleChild = Array.from(svg.children).find(
    (el) => !['defs', 'style', 'title', 'desc'].includes(el.tagName.toLowerCase())
  );
  if (firstVisibleChild) {
    svg.insertBefore(bgRect, firstVisibleChild);
  } else {
    svg.appendChild(bgRect);
  }
}
