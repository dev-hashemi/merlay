/**
 * Pattern matchers for Flowchart arrows and node shape delimiters.
 */

export interface ArrowMatch {
  arrow: string;
  length: number;
}

export interface ShapeMatch {
  shapeType: string;
  label: string;
  raw: string;
  length: number;
}

const ARROW_PATTERNS = [
  '<-->',
  '<-.->',
  '<==>',
  '-.->',
  '==>',
  '-->',
  '--o',
  '--x',
  'o--o',
  'x--x',
  '---',
  '-.-',
  '===',
  '->',
];

export function matchArrow(str: string, pos: number): ArrowMatch | null {
  const sub = str.substring(pos);
  for (const pat of ARROW_PATTERNS) {
    if (sub.startsWith(pat)) {
      return { arrow: pat, length: pat.length };
    }
  }
  return null;
}

const SHAPES: Array<{
  open: string;
  close: string;
  type: string;
}> = [
  { open: '(((', close: ')))', type: 'double_circle' },
  { open: '([', close: '])', type: 'stadium' },
  { open: '[[', close: ']]', type: 'subroutine' },
  { open: '[(', close: ')]', type: 'cylinder' },
  { open: '((', close: '))', type: 'circle' },
  { open: '{{', close: '}}', type: 'hexagon' },
  { open: '[/', close: '/]', type: 'parallelogram' },
  { open: '[/', close: '\\]', type: 'trapezoid' },
  { open: '[\\', close: '\\]', type: 'parallelogram_alt' },
  { open: '[\\', close: '/]', type: 'trapezoid_alt' },
  { open: '>', close: ']', type: 'asymmetric' },
  { open: '[', close: ']', type: 'rectangle' },
  { open: '(', close: ')', type: 'rounded' },
  { open: '{', close: '}', type: 'diamond' },
];

export function matchShape(str: string, pos: number): ShapeMatch | null {
  const sub = str.substring(pos);

  for (const s of SHAPES) {
    if (sub.startsWith(s.open)) {
      const remainder = sub.substring(s.open.length);

      // Check if quoted string inside shape: ["..."]
      if (remainder.startsWith('"')) {
        let qPos = 1;
        let foundEndQuote = false;
        while (qPos < remainder.length) {
          if (remainder[qPos] === '"' && remainder[qPos - 1] !== '\\') {
            foundEndQuote = true;
            break;
          }
          qPos++;
        }

        if (foundEndQuote) {
          const afterQuote = remainder.substring(qPos + 1).trimStart();
          if (afterQuote.startsWith(s.close)) {
            const label = remainder.substring(1, qPos).replace(/#quot;/g, '"');
            const skipWhitespace = remainder.substring(qPos + 1).indexOf(s.close);
            const fullLength = s.open.length + qPos + 1 + skipWhitespace + s.close.length;
            return {
              shapeType: s.type,
              label,
              raw: sub.substring(0, fullLength),
              length: fullLength,
            };
          }
        }
      }

      // Non-quoted or fallback
      const closeIdx = sub.indexOf(s.close, s.open.length);
      if (closeIdx !== -1) {
        let label = sub.substring(s.open.length, closeIdx).trim();
        if (
          (label.startsWith('"') && label.endsWith('"')) ||
          (label.startsWith("'") && label.endsWith("'"))
        ) {
          label = label.slice(1, -1);
        }
        const fullLength = closeIdx + s.close.length;
        return {
          shapeType: s.type,
          label: label.replace(/#quot;/g, '"'),
          raw: sub.substring(0, fullLength),
          length: fullLength,
        };
      }
    }
  }

  return null;
}
