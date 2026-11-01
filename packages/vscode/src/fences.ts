/**
 * Markdown ```mermaid fence enumeration for the CodeLens provider.
 * Pure string logic (bounds math reused from @merlay/core).
 */

import { findMermaidBlockBounds } from '@merlay/core';

export interface MermaidFence {
  startLine: number;
  endLine: number;
  code: string;
}

const OPENING_FENCE_RE = /^\s*```mermaid(\s|$)/;

/** List every ```mermaid fence in a markdown document (unclosed included). */
export function findMermaidFences(text: string): MermaidFence[] {
  const lines = text.split('\n');
  const fences: MermaidFence[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (!OPENING_FENCE_RE.test(lines[i])) continue;
    const bounds = findMermaidBlockBounds(lines, i);
    if (bounds) {
      fences.push({
        startLine: bounds.start,
        endLine: bounds.end,
        code: lines.slice(bounds.start + 1, bounds.end).join('\n'),
      });
      i = bounds.end;
    } else {
      // Unclosed fence: offer the lens anyway, treat rest of doc as code.
      fences.push({
        startLine: i,
        endLine: lines.length - 1,
        code: lines.slice(i + 1).join('\n'),
      });
      break;
    }
  }
  return fences;
}

/** Find the fence containing the line, or the closest fence if outside. */
export function findNearestFence(fences: MermaidFence[], line: number): MermaidFence | undefined {
  if (fences.length === 0) return undefined;
  const inside = fences.find((f) => line >= f.startLine && line <= f.endLine);
  if (inside) return inside;
  let nearest = fences[0];
  let minDistance = Math.min(Math.abs(line - nearest.startLine), Math.abs(line - nearest.endLine));
  for (let i = 1; i < fences.length; i++) {
    const f = fences[i];
    const dist = Math.min(Math.abs(line - f.startLine), Math.abs(line - f.endLine));
    if (dist < minDistance) {
      minDistance = dist;
      nearest = f;
    }
  }
  return nearest;
}

/** Compute human-readable panel title for a given fence in a document. */
export function formatFenceTitle(
  docPath: string,
  fenceStartLine: number,
  fences: MermaidFence[]
): string {
  const fileName = docPath.split(/[/\\]/).pop() ?? 'Document';
  if (fences.length <= 1) {
    return `Merlay: ${fileName} (L${fenceStartLine + 1})`;
  }
  const index = fences.findIndex((f) => f.startLine === fenceStartLine);
  const indexStr = index >= 0 ? `${index + 1}/${fences.length}` : `L${fenceStartLine + 1}`;
  return `Merlay: ${fileName} [${indexStr}]`;
}

export interface EditFenceUriParams {
  targetLine?: number;
  diagramIndex?: number;
  targetFile?: string;
}

/**
 * Extract the percent-encoded query from a URI string.
 * `vscode.Uri.query` is already decoded, which loses separators inside values
 * such as a file path containing `&`; the raw URI string keeps them encoded.
 */
export function getEncodedQuery(uriString: string): string {
  const start = uriString.indexOf('?');
  const hash = uriString.indexOf('#');
  if (start < 0 || (hash >= 0 && hash < start)) return '';
  return uriString.slice(start + 1, hash < 0 ? undefined : hash);
}

/**
 * Parse an incoming custom URI query for editing a mermaid fence.
 * Supported format: vscode://dev-hashemi.merlay/edit-fence?line=15&index=0&file=...
 */
export function parseEditFenceUri(
  uriPath: string,
  queryString: string
): EditFenceUriParams | undefined {
  if (uriPath !== '/edit-fence' && uriPath !== '/edit') return undefined;
  const params = new URLSearchParams(queryString);
  const lineStr = params.get('line');
  const targetLine = lineStr ? parseInt(lineStr, 10) : undefined;
  const indexStr = params.get('index');
  const diagramIndex = indexStr ? parseInt(indexStr, 10) : undefined;
  const targetFile = params.get('file') || undefined;
  return {
    targetLine: typeof targetLine === 'number' && !isNaN(targetLine) ? targetLine : undefined,
    diagramIndex:
      typeof diagramIndex === 'number' && !isNaN(diagramIndex) ? diagramIndex : undefined,
    targetFile,
  };
}

/**
 * Resolve the target fence using index or line number with sensible fallbacks.
 */
export function resolveTargetFence(
  fences: MermaidFence[],
  targetLine?: number,
  diagramIndex?: number
): MermaidFence | undefined {
  if (fences.length === 0) return undefined;
  if (diagramIndex !== undefined && diagramIndex >= 0 && diagramIndex < fences.length) {
    return fences[diagramIndex];
  }
  if (targetLine !== undefined) {
    return findNearestFence(fences, targetLine);
  }
  return fences[0];
}

