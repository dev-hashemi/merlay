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

const ARROW_REGEX =
  /^(?:~{3,}|<={2,}>|<-[.]+->|<-{2,}>|={2,}>|={3,}|-[.]+->|-[.]+-|-{2,}>|-{2,}o|-{2,}x|o-{2,}o|x-{2,}x|o-{2,}|x-{2,}|-{3,}|->)/;

export function matchArrow(str: string, pos: number): ArrowMatch | null {
  const sub = str.substring(pos);
  const match = sub.match(ARROW_REGEX);
  if (match) {
    return { arrow: match[0], length: match[0].length };
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

export interface ShapeMetaMatch {
  /** Full raw text including `@{` ... `}`. */
  raw: string;
  /** Text between the braces (key: value pairs). */
  inner: string;
  length: number;
}

/**
 * Match `@{ ... }` shape metadata at pos (Mermaid v11.3+ node syntax).
 * Respects double-quoted values so `label: "a } b"` doesn't end early.
 * Returns null for `@` that isn't followed by `{` (e.g. edge ids `e1@-->`).
 */
export function matchShapeMeta(str: string, pos: number): ShapeMetaMatch | null {
  if (str[pos] !== '@' || str[pos + 1] !== '{') return null;
  let i = pos + 2;
  let inQuotes = false;
  while (i < str.length) {
    const ch = str[i];
    if (ch === '"' && str[i - 1] !== '\\') inQuotes = !inQuotes;
    if (ch === '}' && !inQuotes) {
      return { raw: str.substring(pos, i + 1), inner: str.substring(pos + 2, i), length: i + 1 - pos };
    }
    i++;
  }
  return null;
}

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
