import { MermaidEdgeDef } from '../diagrams/viewModel';

export interface SvgElementMetadata {
  id?: string | null;
  className?: string | null;
  textContent?: string | null;
}

/**
 * Robustly matches an SVG DOM element (path, group, label) produced by Mermaid.js
 * to its corresponding MermaidEdgeDef AST definition.
 *
 * Supports:
 * - Mermaid v10 underscore IDs: L_From_To_0
 * - Mermaid v9 hyphenated IDs: L-From-To-0
 * - Dagre start/end class annotations: LS_From LE_To
 * - Direct textContent matching against edge labels
 * - Positional sequence index fallback
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function matchSvgEdgeToAst(
  el: SvgElementMetadata,
  edges: MermaidEdgeDef[],
  fallbackIdx?: number
): MermaidEdgeDef | null {
  const idAttr = (el.id || '').trim();
  const classAttr = (el.className || '').trim();
  const textContent = (el.textContent || '').trim();

  // 1. Try matching by SVG id attribute (e.g. L_A_B_0 or L-A-B-0).
  // Mermaid numbers parallel edges between the same nodes with a trailing
  // index (L_A_B_0, L_A_B_1, ...), so collect every from/to match and use
  // the suffix to pick the right one instead of always returning the first.
  if (idAttr) {
    const normId = idAttr.replace(/[-_]/g, '_');
    const candidates: MermaidEdgeDef[] = [];
    for (const edge of edges) {
      const normFrom = edge.from.replace(/[-_]/g, '_');
      const normTo = edge.to.replace(/[-_]/g, '_');
      const pat = `(^|_)L_${escapeRegex(normFrom)}_${escapeRegex(normTo)}(_|$)`;
      if (
        new RegExp(pat).test(normId) ||
        normId.includes(`_${normFrom}_${normTo}_`) ||
        normId.endsWith(`_${normFrom}_${normTo}`) ||
        normId === `${normFrom}_${normTo}`
      ) {
        candidates.push(edge);
      }
    }
    if (candidates.length === 1) return candidates[0];
    if (candidates.length > 1) {
      const suffix = normId.match(/_(\d+)$/);
      if (suffix) {
        const idx = parseInt(suffix[1], 10);
        if (idx < candidates.length) return candidates[idx];
      }
      return candidates[0];
    }
  }

  // 2. Try matching by SVG class attribute (e.g. LS_A LE_B)
  if (classAttr) {
    const normClass = classAttr.replace(/[-_]/g, '_');
    for (const edge of edges) {
      const normFrom = edge.from.replace(/[-_]/g, '_');
      const normTo = edge.to.replace(/[-_]/g, '_');
      const hasFrom = new RegExp(`(^|\\s)LS_${escapeRegex(normFrom)}(\\s|$)`).test(normClass);
      const hasTo = new RegExp(`(^|\\s)LE_${escapeRegex(normTo)}(\\s|$)`).test(normClass);
      if (hasFrom && hasTo) {
        return edge;
      }
      if (normClass.includes(`_${normFrom}_${normTo}_`)) {
        return edge;
      }
    }
  }

  // 3. Try matching by label text content (including sequence diagram autonumber format: "1: Message")
  if (textContent) {
    const cleanText = textContent.replace(/^\d+:\s*/, '').trim();
    const matched = edges.find(
      (ed) =>
        ed.label &&
        (ed.label.trim() === textContent || ed.label.trim() === cleanText)
    );
    if (matched) return matched;
  }

  // 4. Sequential fallback index
  if (
    fallbackIdx !== undefined &&
    fallbackIdx >= 0 &&
    fallbackIdx < edges.length
  ) {
    return edges[fallbackIdx];
  }

  return null;
}
