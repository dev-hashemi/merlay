/**
 * Utilities for locating and safely replacing Mermaid code blocks within Markdown documents.
 * Guarantees that code fence delimiters (```mermaid and ```) are never deleted or corrupted,
 * even when diagrams shrink (deleting nodes) or expand (adding nodes).
 */

export * from './targetBlockFinder';

export interface BlockBounds {
  start: number; // line index of opening ```mermaid
  end: number; // line index of closing ```
}

export interface ReplaceResult {
  updatedText: string;
  newStartLine: number;
  newEndLine: number;
}

/**
 * Every diagram-type header Mermaid v11 accepts. Only used to recognize the
 * first content line of an unclosed block during auto-heal — including types
 * the visual editor cannot parse yet — so their code is not mistaken for
 * document prose. Statement-level recognition stays limited to the supported
 * flowchart/state/sequence syntax; anything else fails safe toward prose.
 */
const DIAGRAM_HEADER_RE =
  /^(flowchart|graph|sequenceDiagram|stateDiagram|classDiagram|erDiagram|journey|gantt|pie|gitGraph|mindmap|timeline|quadrantChart|requirementDiagram|zenuml|kanban|info|c4Context|c4Container|c4Component|c4Dynamic|c4Deployment|sankey-beta|xychart-beta|block-beta|packet-beta|architecture-beta|radar-beta)\b/i;

export function findMermaidBlockBounds(
  lines: string[],
  hintStartLine?: number,
  initialCode?: string,
  latestCode?: string
): BlockBounds | null {
  const findClosingFence = (startIdx: number): number => {
    for (let i = startIdx + 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('```') && !line.startsWith('```mermaid')) {
        return i;
      }
    }
    return -1;
  };

  // 1. Primary check when code content is available: match by code content
  if (initialCode || latestCode) {
    const rawInitial = initialCode?.trim();
    const rawLatest = latestCode?.trim();
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().startsWith('```mermaid')) {
        const end = findClosingFence(i);
        if (end !== -1) {
          const blockContent = lines.slice(i + 1, end).join('\n').trim();
          if (
            (rawInitial && blockContent === rawInitial) ||
            (rawLatest && blockContent === rawLatest)
          ) {
            return { start: i, end };
          }
        }
      }
    }
  }

  const hint = hintStartLine ?? 0;

  // 2. Direct check at hintStartLine
  if (hint >= 0 && hint < lines.length && lines[hint]?.trim().startsWith('```mermaid')) {
    const end = findClosingFence(hint);
    if (end !== -1) {
      return { start: hint, end };
    }
  }

  // 3. Search outward from hint
  for (let offset = 1; offset < lines.length; offset++) {
    for (const sign of [-1, 1]) {
      const candidate = hint + offset * sign;
      if (candidate >= 0 && candidate < lines.length) {
        if (lines[candidate].trim().startsWith('```mermaid')) {
          const end = findClosingFence(candidate);
          if (end !== -1) {
            return { start: candidate, end };
          }
        }
      }
    }
  }

  // 4. Fallback: first mermaid block
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith('```mermaid')) {
      const end = findClosingFence(i);
      if (end !== -1) {
        return { start: i, end };
      }
    }
  }

  return null;
}

export function replaceMermaidBlock(
  documentText: string,
  newCode: string,
  hintStartLine?: number,
  initialCode?: string,
  latestCode?: string
): ReplaceResult {
  const lines = documentText.split('\n');
  const codeLines = newCode.trim().split('\n');
  const bounds = findMermaidBlockBounds(lines, hintStartLine, initialCode, latestCode);

  if (bounds) {
    const { start, end } = bounds;
    const before = lines.slice(0, start + 1); // includes ```mermaid
    const after = lines.slice(end); // includes ``` and everything following
    const newEndLine = start + 1 + codeLines.length;

    return {
      updatedText: [...before, ...codeLines, ...after].join('\n'),
      newStartLine: start,
      newEndLine,
    };
  }

  // Auto-heal case: If an opening ```mermaid exists but no closing fence was found
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith('```mermaid')) {
      const before = lines.slice(0, i + 1);

      // Detect where the unclosed mermaid code ends and regular document text resumes
      let endIdx = lines.length;
      // The first content line is (almost) always the diagram-type header, so
      // every known header is accepted there — including types this editor
      // cannot parse yet (pie, gantt, gitGraph, ...). Later lines use the
      // statement patterns below; unrecognized lines fail safe toward
      // "prose" (visible truncation) rather than swallowing document text.
      let isFirstContentLine = true;
      for (let j = i + 1; j < lines.length; j++) {
        const trimmed = lines[j].trim();
        if (!trimmed) continue;

        // If line is a markdown heading, rule, or other code fence
        if (trimmed.startsWith('#') || trimmed.startsWith('```') || trimmed === '---' || trimmed.startsWith('>')) {
          // Look back to preserve empty lines before headings
          endIdx = j;
          if (j > i + 1 && !lines[j - 1].trim()) {
            endIdx = j - 1;
          }
          break;
        }

        // If line doesn't match Mermaid syntax (flowchart, state, sequence,
        // or a diagram-type header in first-line position).
        // Sequence message arrows (->>, --x, -) ...) require a word char
        // after the arrow so prose like "Warning: check this" is not
        // swallowed into the healed block.
        const isMermaidSyntax =
          (isFirstContentLine && DIAGRAM_HEADER_RE.test(trimmed)) ||
          /^(flowchart|graph|subgraph|end|direction|classDef|class|style|%%|stateDiagram|sequenceDiagram|participant|actor|create|destroy|note|autonumber|loop|alt|else|opt|par|and|rect|box|critical|option|break|title|accTitle|accDescr)\b/i.test(trimmed) ||
          /^state\b(?=.*("|\bas\b|[{]}|<<|\[\*\]|-->|:))/i.test(trimmed) ||
          /(-->|--|==>|===|-\.->|-.-|<-->|<==>|\[.*\]|\(.*\)|{.*}|\[\*\]|:::|---|-+[->x)]+\s*\w|;)/.test(trimmed);
        isFirstContentLine = false;

        if (!isMermaidSyntax) {
          endIdx = j;
          break;
        }
      }

      const after = lines.slice(endIdx);
      const newEndLine = i + 1 + codeLines.length;
      return {
        updatedText: [...before, ...codeLines, '```', ...after].join('\n'),
        newStartLine: i,
        newEndLine,
      };
    }
  }

  // Failsafe: append a complete block to the document
  const appendText = `${documentText.trimEnd()}\n\n\`\`\`mermaid\n${newCode.trim()}\n\`\`\`\n`;
  const appendLines = appendText.split('\n');
  return {
    updatedText: appendText,
    newStartLine: Math.max(0, appendLines.length - codeLines.length - 2),
    newEndLine: appendLines.length - 2,
  };
}
