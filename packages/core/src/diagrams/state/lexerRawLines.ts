/**
 * Verbatim raw line detection for State Diagrams
 * Preserves statements the visual editor does not model so visual edits never corrupt them.
 */

/** True when ':::' occurs outside quoted strings (inline classDef shorthand). */
export function containsInlineClassShorthand(line: string): boolean {
  let quoteChar: string | null = null;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoteChar) {
      if (ch === quoteChar && line[i - 1] !== '\\') quoteChar = null;
    } else if (ch === '"' || ch === "'") {
      quoteChar = ch;
    } else if (line.startsWith(':::', i)) {
      return true;
    }
  }
  return false;
}

/**
 * Statements the editor does not model are preserved verbatim so visual
 * edits never corrupt or drop hand-written code (accTitle, accDescr, notes, classDefs, --, :::).
 * Click interaction statements (click <id> href|call|...) are preserved too —
 * but only when the line carries no transition arrow (a state literally
 * named "click" still uses `click --> X`) and has an action (a lone
 * `click` stays a normal state declaration).
 */
export function isStateRawLine(trimmed: string): boolean {
  return (
    /^(note|classdef|class|acctitle|accdescr|title)\b/i.test(trimmed) ||
    (/^click\s+\S+\s+\S/i.test(trimmed) && !trimmed.includes('-->')) ||
    /^--(\s.*)?$/.test(trimmed) ||
    containsInlineClassShorthand(trimmed)
  );
}
