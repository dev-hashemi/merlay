/**
 * SVG Marker and Edge presentation attribute styling and cloning for export.
 */

/**
 * Helper to safely find a marker element by ID in SVG DOM.
 */
export function findMarkerById(root: Element, id: string): SVGMarkerElement | null {
  try {
    const el = root.querySelector(`marker[id="${CSS.escape(id)}"]`);
    if (el) return el as SVGMarkerElement;
  } catch {
    // Fallback if CSS.escape is unavailable
  }
  const markers = root.querySelectorAll('marker');
  for (let i = 0; i < markers.length; i++) {
    if (markers[i].getAttribute('id') === id) {
      return markers[i] as SVGMarkerElement;
    }
  }
  return null;
}

/**
 * Extracts marker ID referenced by marker-end or marker-start on an element or its ancestors.
 */
export function getMarkerIdFromElement(edgeEl: Element, attr: 'marker-end' | 'marker-start'): string | null {
  let cur: Element | null = edgeEl;
  while (cur && cur.tagName.toLowerCase() !== 'svg') {
    const val = cur.getAttribute(attr) || (cur as HTMLElement).style?.getPropertyValue?.(attr);
    if (val) {
      const match = val.match(/url\(['"]?#([^'"]+?)['"]?\)/i);
      if (match) return match[1];
    }
    cur = cur.parentElement;
  }
  return null;
}

/**
 * Traverses element and ancestors to find any explicit stroke color.
 */
export function getExplicitStrokeColor(el: Element): string | null {
  let cur: Element | null = el;
  while (cur && cur.tagName.toLowerCase() !== 'svg') {
    const styleAttr = cur.getAttribute('style') || '';
    const strokeMatch = styleAttr.match(/(?:^|;)\s*stroke\s*:\s*([^;!]+)/i);
    if (strokeMatch && strokeMatch[1].trim() && strokeMatch[1].trim().toLowerCase() !== 'none') {
      return strokeMatch[1].trim();
    }
    const strokeAttr = cur.getAttribute('stroke');
    if (strokeAttr && strokeAttr.trim() && strokeAttr.trim().toLowerCase() !== 'none') {
      return strokeAttr.trim();
    }
    cur = cur.parentElement;
  }
  return null;
}

/**
 * Sets explicit fill, stroke, and inline styles on a marker and all its child shapes.
 */
export function applyMarkerColor(marker: SVGMarkerElement, color: string): void {
  marker.setAttribute('fill', color);
  marker.setAttribute('stroke', color);

  marker.querySelectorAll('path, polygon, circle, line, rect').forEach((child) => {
    child.setAttribute('fill', color);
    child.setAttribute('stroke', color);
  });
}

const EDGE_SELECTOR = [
  '.edgePaths path',
  '.edgePath path',
  'path.transition',
  'path.path',
  'path.flowchart-link',
  '[class*="flowchart-link"]',
  'path[id^="edge"]',
  'path[id^="L_"]',
  'path[id^="L-"]',
  'path[data-edge="true"]',
  'line[class*="messageLine"]',
  'path[class*="messageLine"]',
  'line.messageLine0',
  'line.messageLine1',
  'path.relation',
  'path.edge',
  'path[class*="edge"]',
  'path[marker-end]',
  'path[marker-start]',
  'line[marker-end]',
  'line[marker-start]',
].join(', ');

/**
 * Iterates edge paths and lines, computes stroke colors/widths/patterns,
 * and clones markers where necessary so that colored edges have matching marker colors.
 */
export function applyEdgeAndMarkerStyling(
  svg: SVGSVGElement,
  defs: SVGDefsElement,
  defaultArrowColor: string
): void {
  const markerAssignedColor = new Map<string, string>();
  const markerClones = new Map<string, Map<string, string>>();
  const processedEdges = new Set<Element>();

  svg.querySelectorAll(EDGE_SELECTOR).forEach((el) => {
    if (
      el.closest('defs') ||
      el.closest('marker') ||
      el.classList.contains('mermaid-edge-hit-area') ||
      el.classList.contains('mermaid-node-selection-halo') ||
      el.classList.contains('mermaid-lifeline-hit-area') ||
      el.classList.contains('actor-line')
    ) {
      return;
    }
    if (processedEdges.has(el)) return;
    processedEdges.add(el);

    if (
      el.classList.contains('edge-thickness-invisible') ||
      el.closest('.edge-thickness-invisible') ||
      el.getAttribute('style')?.includes('opacity: 0') ||
      el.getAttribute('style')?.includes('opacity:0')
    ) {
      el.setAttribute('stroke', 'none');
      el.setAttribute('fill', 'none');
      return;
    }

    const explicitStroke = getExplicitStrokeColor(el);
    const strokeColor = explicitStroke || defaultArrowColor;

    let strokeWidth = '1.5';
    if (el.classList.contains('edge-thickness-thick') || el.closest('.edge-thickness-thick')) {
      strokeWidth = '3.5';
    } else {
      const explicitWidth =
        el.getAttribute('stroke-width') ||
        (el as HTMLElement).style?.strokeWidth ||
        (el.closest('.edgePath') as HTMLElement)?.style?.strokeWidth;
      if (explicitWidth && explicitWidth !== '0' && explicitWidth !== '0px') {
        strokeWidth = explicitWidth;
      }
    }

    if (el.classList.contains('edge-pattern-dashed') || el.closest('.edge-pattern-dashed')) {
      el.setAttribute('stroke-dasharray', '5, 5');
    } else if (
      el.classList.contains('edge-pattern-dotted') ||
      el.closest('.edge-pattern-dotted') ||
      el.classList.contains('messageLine1')
    ) {
      el.setAttribute('stroke-dasharray', '3, 3');
    }

    el.setAttribute('stroke', strokeColor);
    el.setAttribute('stroke-width', strokeWidth);
    el.setAttribute('fill', 'none');

    (['marker-end', 'marker-start'] as const).forEach((attr) => {
      const markerId = getMarkerIdFromElement(el, attr);
      if (!markerId) return;

      const baseMarker = findMarkerById(svg, markerId);
      if (!baseMarker) return;

      const assigned = markerAssignedColor.get(markerId);

      if (!assigned) {
        markerAssignedColor.set(markerId, strokeColor);
        applyMarkerColor(baseMarker, strokeColor);
      } else if (assigned.toLowerCase() === strokeColor.toLowerCase()) {
        applyMarkerColor(baseMarker, strokeColor);
      } else {
        let clonesForMarker = markerClones.get(markerId);
        if (!clonesForMarker) {
          clonesForMarker = new Map<string, string>();
          markerClones.set(markerId, clonesForMarker);
        }

        const safeColorStr = strokeColor.replace(/[^a-zA-Z0-9_-]/g, '_');
        let clonedId = clonesForMarker.get(strokeColor);

        if (!clonedId) {
          clonedId = `${markerId}__${safeColorStr}`;
          let clonedMarker = findMarkerById(defs, clonedId);
          if (!clonedMarker) {
            clonedMarker = baseMarker.cloneNode(true) as SVGMarkerElement;
            clonedMarker.setAttribute('id', clonedId);
            defs.appendChild(clonedMarker);
          }
          applyMarkerColor(clonedMarker, strokeColor);
          clonesForMarker.set(strokeColor, clonedId);
        }

        el.setAttribute(attr, `url(#${clonedId})`);
        const parentEdge = el.closest('.edgePath, .edge');
        if (parentEdge && parentEdge.hasAttribute(attr)) {
          parentEdge.setAttribute(attr, `url(#${clonedId})`);
        }
      }
    });
  });
}
