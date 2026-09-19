/**
 * Tokenizer for Mermaid State Diagrams
 */

export type StateTokenType =
  | 'DIRECTIVE'         // stateDiagram-v2, stateDiagram
  | 'DIRECTION_KEYWORD' // direction
  | 'DIRECTION'         // TB, TD, BT, RL, LR
  | 'STATE_KEYWORD'     // state
  | 'AS_KEYWORD'        // as
  | 'START_END'         // [*]
  | 'ARROW'             // -->
  | 'COLON'             // :
  | 'CHOICE'            // <<choice>>
  | 'FORK'              // <<fork>>
  | 'JOIN'              // <<join>>
  | 'OPEN_BRACE'        // {
  | 'CLOSE_BRACE'       // }
  | 'NOTE'              // note
  | 'STYLE'             // style
  | 'CLASS_DEF'         // classDef
  | 'CLASS'             // class
  | 'IDENTIFIER'        // state name or keyword
  | 'STRING'            // "quoted string"
  | 'COMMENT'           // %% comment
  | 'RAW_LINE'          // unsupported statement preserved verbatim (notes, classDefs, --, :::)
  | 'NEWLINE'
  | 'EOF';

export interface StateToken {
  type: StateTokenType;
  value: string;
  line: number;
  col: number;
}

/** True when ':::' occurs outside quoted strings (inline classDef shorthand). */
function containsInlineClassShorthand(line: string): boolean {
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

export function tokenizeStateDiagram(input: string): StateToken[] {
  const tokens: StateToken[] = [];
  const lines = input.split('\n');

  let inMultiLineNote = false;

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const rawLine = lines[lineIdx];
    const trimmed = rawLine.trim();

    if (!trimmed) {
      tokens.push({ type: 'NEWLINE', value: '\n', line: lineIdx + 1, col: 1 });
      continue;
    }

    if (inMultiLineNote) {
      tokens.push({
        type: 'RAW_LINE',
        value: trimmed,
        line: lineIdx + 1,
        col: 1,
      });
      tokens.push({ type: 'NEWLINE', value: '\n', line: lineIdx + 1, col: rawLine.length + 1 });
      if (/^end\s+note\b/i.test(trimmed)) {
        inMultiLineNote = false;
      }
      continue;
    }

    if (/^accDescr\s*\{/i.test(trimmed)) {
      const blockLines = [trimmed];
      while (lineIdx + 1 < lines.length && lines[lineIdx + 1].trim() !== '}') {
        lineIdx++;
        blockLines.push('    ' + lines[lineIdx].trim());
      }
      if (lineIdx + 1 < lines.length && lines[lineIdx + 1].trim() === '}') {
        lineIdx++;
        blockLines.push(lines[lineIdx].trim());
      }
      tokens.push({
        type: 'RAW_LINE',
        value: blockLines.join('\n    '),
        line: lineIdx + 1,
        col: 1,
      });
      tokens.push({ type: 'NEWLINE', value: '\n', line: lineIdx + 1, col: rawLine.length + 1 });
      continue;
    }

    if (trimmed.startsWith('%%')) {
      tokens.push({
        type: 'COMMENT',
        value: trimmed,
        line: lineIdx + 1,
        col: rawLine.indexOf('%') + 1,
      });
      tokens.push({ type: 'NEWLINE', value: '\n', line: lineIdx + 1, col: rawLine.length + 1 });
      continue;
    }

    // Statements the editor does not model are preserved verbatim so visual
    // edits never corrupt or drop hand-written code (accTitle, accDescr, notes, classDefs, --, :::).
    // Click interaction statements (click <id> href|call|...) are preserved too —
    // but only when the line carries no transition arrow (a state literally
    // named "click" still uses `click --> X`) and has an action (a lone
    // `click` stays a normal state declaration).
    if (
      /^(note|classdef|class|acctitle|accdescr|title)\b/i.test(trimmed) ||
      (/^click\s+\S+\s+\S/i.test(trimmed) && !trimmed.includes('-->')) ||
      /^--(\s.*)?$/.test(trimmed) ||
      containsInlineClassShorthand(trimmed)
    ) {
      if (/^note\s+(right\s+of|left\s+of)\b/i.test(trimmed) && !trimmed.includes(':')) {
        inMultiLineNote = true;
      }
      tokens.push({
        type: 'RAW_LINE',
        value: trimmed,
        line: lineIdx + 1,
        col: 1,
      });
      tokens.push({ type: 'NEWLINE', value: '\n', line: lineIdx + 1, col: rawLine.length + 1 });
      continue;
    }

    let pos = 0;
    while (pos < rawLine.length) {
      const char = rawLine[pos];

      // Skip whitespace
      if (char === ' ' || char === '\t' || char === '\r') {
        pos++;
        continue;
      }

      // Trailing comment: everything from %% to end of line
      if (rawLine.startsWith('%%', pos)) {
        tokens.push({
          type: 'COMMENT',
          value: rawLine.substring(pos).trim(),
          line: lineIdx + 1,
          col: pos + 1,
        });
        pos = rawLine.length;
        continue;
      }

      // Check for start/end pseudo-state [*]
      if (rawLine.startsWith('[*]', pos)) {
        tokens.push({
          type: 'START_END',
          value: '[*]',
          line: lineIdx + 1,
          col: pos + 1,
        });
        pos += 3;
        continue;
      }

      // Check for transition arrow -->
      if (rawLine.startsWith('-->', pos)) {
        tokens.push({
          type: 'ARROW',
          value: '-->',
          line: lineIdx + 1,
          col: pos + 1,
        });
        pos += 3;
        continue;
      }

      // Check for stereotypes <<choice>>, <<fork>>, <<join>>
      if (rawLine.startsWith('<<choice>>', pos)) {
        tokens.push({ type: 'CHOICE', value: '<<choice>>', line: lineIdx + 1, col: pos + 1 });
        pos += 10;
        continue;
      }
      if (rawLine.startsWith('<<fork>>', pos)) {
        tokens.push({ type: 'FORK', value: '<<fork>>', line: lineIdx + 1, col: pos + 1 });
        pos += 8;
        continue;
      }
      if (rawLine.startsWith('<<join>>', pos)) {
        tokens.push({ type: 'JOIN', value: '<<join>>', line: lineIdx + 1, col: pos + 1 });
        pos += 8;
        continue;
      }

      // Check for braces
      if (char === '{') {
        tokens.push({ type: 'OPEN_BRACE', value: '{', line: lineIdx + 1, col: pos + 1 });
        pos++;
        continue;
      }
      if (char === '}') {
        tokens.push({ type: 'CLOSE_BRACE', value: '}', line: lineIdx + 1, col: pos + 1 });
        pos++;
        continue;
      }

      // Check for colon
      if (char === ':') {
        // The rest of the line after colon is often the label
        tokens.push({ type: 'COLON', value: ':', line: lineIdx + 1, col: pos + 1 });
        pos++;
        // Capture remainder of line as label if present
        const labelText = rawLine.substring(pos).trim();
        if (labelText) {
          tokens.push({
            type: 'STRING',
            value: labelText,
            line: lineIdx + 1,
            col: pos + 1,
          });
          pos = rawLine.length;
        }
        continue;
      }

      // Check for quoted strings e.g. "My State Description"
      if (char === '"' || char === "'") {
        const quoteChar = char;
        let endIdx = pos + 1;
        let escaped = false;
        while (endIdx < rawLine.length) {
          if (rawLine[endIdx] === quoteChar && !escaped) {
            break;
          }
          escaped = rawLine[endIdx] === '\\' && !escaped;
          endIdx++;
        }
        const val = rawLine.substring(pos + 1, endIdx);
        tokens.push({
          type: 'STRING',
          value: val,
          line: lineIdx + 1,
          col: pos + 1,
        });
        pos = endIdx + 1;
        continue;
      }

      // General word / identifier
      let wordEnd = pos;
      while (
        wordEnd < rawLine.length &&
        !/[\s{}:"]/.test(rawLine[wordEnd]) &&
        !rawLine.startsWith('-->', wordEnd) &&
        !rawLine.startsWith('[*]', wordEnd) &&
        !rawLine.startsWith('<<', wordEnd)
      ) {
        wordEnd++;
      }

      if (wordEnd > pos) {
        const word = rawLine.substring(pos, wordEnd);
        const lower = word.toLowerCase();
        const upper = word.toUpperCase();

        if (lower === 'statediagram-v2' || lower === 'statediagram') {
          tokens.push({ type: 'DIRECTIVE', value: word, line: lineIdx + 1, col: pos + 1 });
        } else if (lower === 'direction') {
          tokens.push({ type: 'DIRECTION_KEYWORD', value: word, line: lineIdx + 1, col: pos + 1 });
        } else if (
          ['TB', 'TD', 'BT', 'RL', 'LR'].includes(upper) &&
          tokens.length > 0 &&
          tokens[tokens.length - 1].type === 'DIRECTION_KEYWORD'
        ) {
          tokens.push({ type: 'DIRECTION', value: upper, line: lineIdx + 1, col: pos + 1 });
        } else if (lower === 'state') {
          tokens.push({ type: 'STATE_KEYWORD', value: word, line: lineIdx + 1, col: pos + 1 });
        } else if (lower === 'as') {
          tokens.push({ type: 'AS_KEYWORD', value: word, line: lineIdx + 1, col: pos + 1 });
        } else if (lower === 'note') {
          tokens.push({ type: 'NOTE', value: word, line: lineIdx + 1, col: pos + 1 });
        } else if (lower === 'style') {
          tokens.push({ type: 'STYLE', value: word, line: lineIdx + 1, col: pos + 1 });
        } else if (lower === 'classdef') {
          tokens.push({ type: 'CLASS_DEF', value: word, line: lineIdx + 1, col: pos + 1 });
        } else if (lower === 'class') {
          tokens.push({ type: 'CLASS', value: word, line: lineIdx + 1, col: pos + 1 });
        } else {
          tokens.push({ type: 'IDENTIFIER', value: word, line: lineIdx + 1, col: pos + 1 });
        }

        pos = wordEnd;
        continue;
      }

      pos++;
    }

    tokens.push({ type: 'NEWLINE', value: '\n', line: lineIdx + 1, col: rawLine.length + 1 });
  }

  tokens.push({ type: 'EOF', value: '', line: lines.length + 1, col: 1 });
  return tokens;
}
