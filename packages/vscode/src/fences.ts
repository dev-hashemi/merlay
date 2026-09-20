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
