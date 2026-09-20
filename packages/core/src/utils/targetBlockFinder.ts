export interface TargetMermaidBlockQuery {
  content: string;
  hintLine?: number;
  domIndex?: number;
  domText?: string;
  sectionLineStart?: number;
}

export interface TargetMermaidBlockResult {
  lineStart: number;
  lineEnd: number;
  rawCode: string;
}

/**
 * Score how well a block's tokens match text in domText (from SVG rendered labels).
 */
function scoreBlockTokens(b: TargetMermaidBlockResult, lowerText: string): number {
  const tokens = b.rawCode
    .split(/[^a-zA-Z0-9_]+/)
    .filter((t) => t.length >= 1)
    .map((t) => t.toLowerCase())
    .filter(
      (t) =>
        ![
          'flowchart',
          'graph',
          'statediagram',
          'v2',
          'direction',
          'style',
          'classdef',
          'class',
          'state',
          'subgraph',
          'end',
          'lr',
          'td',
          'tb',
          'rl',
          'bt',
        ].includes(t)
    );

  let score = 0;
  for (const token of tokens) {
    if (token.length >= 2 && lowerText.includes(token)) {
      score += 2;
    } else if (token.length === 1 && new RegExp(`\\b${token}\\b`, 'i').test(lowerText)) {
      score += 1;
    }
  }
  return score;
}

export function findTargetMermaidBlock(
  query: TargetMermaidBlockQuery
): TargetMermaidBlockResult | null {
  const { content, hintLine, domIndex, domText, sectionLineStart } = query;
  // The opening fence may carry an info string (e.g. ```mermaid theme-dark).
  const blockRegex = /```mermaid(?:[ \t][^\n]*)?\r?\n([\s\S]*?)```/g;
  const matches = Array.from(content.matchAll(blockRegex));
  if (matches.length === 0) return null;

  const blocks: TargetMermaidBlockResult[] = matches.map((m) => {
    const matchIndex = m.index || 0;
    const linesBefore = content.substring(0, matchIndex).split('\n');
    const matchLines = m[0].split('\n');
    const lineStart = linesBefore.length - 1;
    const lineEnd = lineStart + matchLines.length - 1;
    return {
      lineStart,
      lineEnd,
      rawCode: m[1],
    };
  });

  if (blocks.length === 1) {
    return blocks[0];
  }

  const lowerDomText = domText ? domText.toLowerCase().trim() : '';

  // 1. Direct sectionLineStart match (from context.getSectionInfo or dataset)
  if (typeof sectionLineStart === 'number' && !isNaN(sectionLineStart)) {
    const exactMatch = blocks.find((b) => b.lineStart === sectionLineStart);
    if (exactMatch) return exactMatch;
    const closeMatch = blocks.find(
      (b) => Math.abs(b.lineStart - sectionLineStart) <= 1
    );
    if (closeMatch) return closeMatch;
  }

  // 2. Editor position / hint line (from CodeMirror posAtDOM or cursor)
  if (typeof hintLine === 'number' && !isNaN(hintLine) && hintLine >= 0) {
    // 2a. Strict interior check: hintLine is within [lineStart, lineEnd] (NO +1 so back-to-back blocks do not overlap!)
    const strictlyInside = blocks.filter(
      (b) => hintLine >= b.lineStart && hintLine <= b.lineEnd
    );

    if (strictlyInside.length === 1) {
      const candidate = strictlyInside[0];
      // Check boundary: if hintLine is on candidate.lineEnd and another block starts at candidate.lineEnd + 1
      const nextBlock = blocks.find((b) => b.lineStart === candidate.lineEnd + 1);
      if (nextBlock && hintLine === candidate.lineEnd) {
        if (lowerDomText.length > 0) {
          const candScore = scoreBlockTokens(candidate, lowerDomText);
          const nextScore = scoreBlockTokens(nextBlock, lowerDomText);
          if (nextScore > candScore) {
            return nextBlock;
          }
        }
        if (typeof domIndex === 'number' && domIndex >= 0 && domIndex < blocks.length) {
          if (blocks[domIndex] === nextBlock) {
            return nextBlock;
          }
        }
      }
      return candidate;
    } else if (strictlyInside.length > 1) {
      // Disambiguate multiple overlapping candidates
      if (lowerDomText.length > 0) {
        let best = strictlyInside[0];
        let maxScore = -1;
        for (const b of strictlyInside) {
          const s = scoreBlockTokens(b, lowerDomText);
          if (s > maxScore) {
            maxScore = s;
            best = b;
          }
        }
        if (maxScore > 0) return best;
      }
      if (typeof domIndex === 'number' && domIndex >= 0 && domIndex < blocks.length) {
        if (strictlyInside.includes(blocks[domIndex])) {
          return blocks[domIndex];
        }
      }
      return strictlyInside[0];
    }
  }

  // 3. Content token scoring across all blocks (direct match with rendered SVG text)
  if (lowerDomText.length > 0) {
    let bestScore = -1;
    let bestMatch: TargetMermaidBlockResult | null = null;

    for (const b of blocks) {
      const score = scoreBlockTokens(b, lowerDomText);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = b;
      }
    }

    if (bestScore > 0 && bestMatch) {
      return bestMatch;
    }
  }

  // 4. Sequential DOM index match
  if (
    typeof domIndex === 'number' &&
    domIndex >= 0 &&
    domIndex < blocks.length
  ) {
    return blocks[domIndex];
  }

  // 5. Distance fallback
  if (typeof hintLine === 'number' && !isNaN(hintLine) && hintLine >= 0) {
    let bestBlock = blocks[0];
    let minDistance = Infinity;
    for (const b of blocks) {
      const dist = Math.min(
        Math.abs(hintLine - b.lineStart),
        Math.abs(hintLine - b.lineEnd)
      );
      if (dist < minDistance) {
        minDistance = dist;
        bestBlock = b;
      }
    }
    return bestBlock;
  }

  return blocks[0];
}

export function isCursorInMermaidBlock(
  content: string,
  cursorLine: number
): TargetMermaidBlockResult | null {
  const blockRegex = /```mermaid(?:[ \t][^\n]*)?\r?\n([\s\S]*?)```/g;
  const matches = Array.from(content.matchAll(blockRegex));
  for (const m of matches) {
    const matchIndex = m.index || 0;
    const linesBefore = content.substring(0, matchIndex).split('\n');
    const matchLines = m[0].split('\n');
    const lineStart = linesBefore.length - 1;
    const lineEnd = lineStart + matchLines.length - 1;
    if (cursorLine >= lineStart && cursorLine <= lineEnd) {
      return {
        lineStart,
        lineEnd,
        rawCode: m[1],
      };
    }
  }
  return null;
}
