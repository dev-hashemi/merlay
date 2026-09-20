import { MermaidNodeDef } from '../../diagrams/viewModel';
import { SvgDomAdapter } from '../../diagrams/types';

/**
 * Resolves the logical diagram node ID from an SVG element using driver resolvers,
 * standard attributes, prefix matching, or label text matching.
 */
export function matchNodeElementId(
  htmlEl: SVGGraphicsElement,
  dom: SvgDomAdapter,
  displayNodes: Map<string, MermaidNodeDef>,
  prefixes: string[]
): string | null {
  const idAttr = htmlEl.getAttribute('id') || '';
  const anchorNodeId = dom.anchorNodeId;
  const isAnchorEl = dom.isAnchorElement;

  // 0. Custom driver resolver (e.g. mindmap preorder sequential mapping)
  if (dom.resolveNodeId) {
    const customId = dom.resolveNodeId(htmlEl, displayNodes);
    if (customId) return customId;
  }

  // 1. Direct name or data-id attribute (standard in Mermaid sequence participants, actors, lifelines)
  const directName =
    htmlEl.getAttribute('name') ||
    htmlEl.getAttribute('data-id') ||
    htmlEl.getAttribute('data-actor-id');
  if (directName && displayNodes.has(directName)) {
    return directName;
  }

  // 2. Closest ancestor with name or data-id (e.g. inner rect/text inside actor-man figure or top container)
  const containerName =
    htmlEl.closest?.('[name]')?.getAttribute('name') ||
    htmlEl.closest?.('[data-id]')?.getAttribute('data-id');
  if (containerName && displayNodes.has(containerName)) {
    return containerName;
  }

  // 3. Anchor state [*] element
  if (isAnchorEl && isAnchorEl(htmlEl)) {
    const compId = dom.getAnchorCompositeId?.(htmlEl) ?? null;
    return compId ? `${anchorNodeId || '[*]'}:${compId}` : (anchorNodeId || '[*]');
  }

  // 4. Prefix or exact ID matching (flowchart/state nodes)
  for (const nid of displayNodes.keys()) {
    if (nid === anchorNodeId) continue;
    if (
      prefixes.some(
        (p) => idAttr.includes(`${p}${nid}-`) || idAttr === `${p}${nid}`
      ) ||
      idAttr.endsWith(`-${nid}`) ||
      idAttr === nid
    ) {
      return nid;
    }
  }

  // 5. Indexed actor fallback (actor0, actor1)
  if (/^actor(\d+)$/.test(idAttr)) {
    const idx = parseInt(idAttr.replace('actor', ''), 10);
    const keys = Array.from(displayNodes.keys());
    if (idx >= 0 && idx < keys.length) {
      return keys[idx];
    }
  }

  // 6. Text label content matching
  const labelText = htmlEl.querySelector('.label, text')?.textContent?.trim() || htmlEl.textContent?.trim();
  for (const [nid, ndef] of displayNodes.entries()) {
    if (ndef.label === labelText || nid === labelText) {
      return nid;
    }
  }

  return null;
}
