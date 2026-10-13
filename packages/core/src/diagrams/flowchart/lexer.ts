/**
 * Tokenizer for Mermaid Flowcharts
 */

import { matchArrow, matchInfixArrow, matchShape, matchShapeMeta } from './lexerMatchers';

export type TokenType =
  | 'DIRECTIVE'       // flowchart, graph
  | 'DIRECTION'       // TB, TD, BT, RL, LR
  | 'DIRECTION_KEYWORD' // direction
  | 'SUBGRAPH'        // subgraph
  | 'END'             // end
  | 'IDENTIFIER'      // node ID or word
  | 'NODE_SHAPE'      // shape with text e.g. [My Node]
  | 'SHAPE_META'      // @{ shape: docs, label: "..." } (Mermaid v11.3+)
  | 'ARROW'           // -->, -.->, ==>, etc.
  | 'ARROW_LABEL'     // |label|
  | 'AND'             // &
  | 'STYLE'           // style
  | 'LINK_STYLE'      // linkStyle
  | 'CLASS_DEF'       // classDef
  | 'CLASS'           // class
  | 'CLASS_ASSIGN'    // :::
  | 'COMMENT'         // %%
  | 'NEWLINE'         // \n
  | 'EOF';

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  col: number;
  shapeType?: string;
  labelText?: string;
  /** Raw inside of `@{ ... }` for SHAPE_META tokens. */
  metaInner?: string;
}

export function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  const lines = input.split('\n');

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const rawLine = lines[lineIdx];
    const trimmed = rawLine.trim();

    if (!trimmed) {
      tokens.push({ type: 'NEWLINE', value: '\n', line: lineIdx + 1, col: 1 });
      continue;
    }

    if (trimmed.startsWith('%%{')) {
      const directiveLines: string[] = [trimmed];
      if (!trimmed.includes('}%%')) {
        while (lineIdx + 1 < lines.length) {
          lineIdx++;
          const nextTrimmed = lines[lineIdx].trim();
          directiveLines.push(lines[lineIdx]);
          if (nextTrimmed.includes('}%%')) {
            break;
          }
        }
      }
      tokens.push({
        type: 'COMMENT',
        value: directiveLines.join('\n'),
        line: lineIdx + 1,
        col: rawLine.indexOf('%') + 1,
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

    let pos = 0;
    while (pos < rawLine.length) {
      const char = rawLine[pos];

      // Skip whitespace
      if (char === ' ' || char === '\t' || char === '\r') {
        pos++;
        continue;
      }

      // Check for '&' operator (fan-out / fan-in)
      if (char === '&') {
        tokens.push({
          type: 'AND',
          value: '&',
          line: lineIdx + 1,
          col: pos + 1,
        });
        pos++;
        continue;
      }

      // Check for Arrow Label |label| (respects quotes so |"A | B"| does not split)
      if (char === '|') {
        let endPipe = -1;
        let inQuotes = false;
        for (let i = pos + 1; i < rawLine.length; i++) {
          const ch = rawLine[i];
          if (ch === '"' && rawLine[i - 1] !== '\\') {
            inQuotes = !inQuotes;
          }
          if (ch === '|' && !inQuotes) {
            endPipe = i;
            break;
          }
        }
        if (endPipe !== -1) {
          let label = rawLine.substring(pos + 1, endPipe);
          if (
            (label.startsWith('"') && label.endsWith('"')) ||
            (label.startsWith("'") && label.endsWith("'"))
          ) {
            label = label.slice(1, -1);
          }
          tokens.push({
            type: 'ARROW_LABEL',
            value: label,
            labelText: label,
            line: lineIdx + 1,
            col: pos + 1,
          });
          pos = endPipe + 1;
          continue;
        }
      }

      // Check for infix arrows: -- label -->
      const infixMatch = matchInfixArrow(rawLine, pos);
      if (infixMatch) {
        tokens.push({
          type: 'ARROW',
          value: infixMatch.arrow,
          line: lineIdx + 1,
          col: pos + 1,
        });
        tokens.push({
          type: 'ARROW_LABEL',
          value: infixMatch.label,
          labelText: infixMatch.label,
          line: lineIdx + 1,
          col: pos + 1 + infixMatch.prefix.length,
        });
        pos += infixMatch.length;
        continue;
      }

      // Check for arrows
      const arrowMatch = matchArrow(rawLine, pos);
      if (arrowMatch) {
        tokens.push({
          type: 'ARROW',
          value: arrowMatch.arrow,
          line: lineIdx + 1,
          col: pos + 1,
        });
        pos += arrowMatch.length;
        continue;
      }

      // Check for @{ ... } shape metadata (must precede word scan so the
      // `@` isn't swallowed into an identifier; e1@--> style edge ids don't
      // match because matchShapeMeta requires `@{`).
      const metaMatch = matchShapeMeta(rawLine, pos);
      if (metaMatch) {
        tokens.push({
          type: 'SHAPE_META',
          value: metaMatch.raw,
          metaInner: metaMatch.inner,
          line: lineIdx + 1,
          col: pos + 1,
        });
        pos += metaMatch.length;
        continue;
      }

      // Check for shape delimiters starting at pos
      const shapeMatch = matchShape(rawLine, pos);
      if (shapeMatch) {
        tokens.push({
          type: 'NODE_SHAPE',
          value: shapeMatch.raw,
          shapeType: shapeMatch.shapeType,
          labelText: shapeMatch.label,
          line: lineIdx + 1,
          col: pos + 1,
        });
        pos += shapeMatch.length;
        continue;
      }

      // Check for class attachment shorthand :::
      if (rawLine.startsWith(':::', pos)) {
        tokens.push({
          type: 'CLASS_ASSIGN',
          value: ':::',
          line: lineIdx + 1,
          col: pos + 1,
        });
        pos += 3;
        continue;
      }

      // Check for string in quotes e.g. "My Node"
      if (char === '"') {
        const endQuote = rawLine.indexOf('"', pos + 1);
        if (endQuote !== -1) {
          const val = rawLine.substring(pos + 1, endQuote);
          tokens.push({
            type: 'IDENTIFIER',
            value: val,
            line: lineIdx + 1,
            col: pos + 1,
          });
          pos = endQuote + 1;
          continue;
        }
      }

      // General word / identifier (stops before @{ shape meta, arrow, or operators)
      let wordEnd = pos;
      while (
        wordEnd < rawLine.length &&
        !/[\s[(){}|%">]/.test(rawLine[wordEnd]) &&
        rawLine[wordEnd] !== '&' &&
        !(rawLine[wordEnd] === '@' && rawLine[wordEnd + 1] === '{') &&
        !matchInfixArrow(rawLine, wordEnd) &&
        !matchArrow(rawLine, wordEnd) &&
        !rawLine.startsWith(':::', wordEnd)
      ) {
        wordEnd++;
      }

      if (wordEnd > pos) {
        const word = rawLine.substring(pos, wordEnd);
        const upper = word.toUpperCase();

        if (word === 'flowchart' || word === 'graph') {
          tokens.push({ type: 'DIRECTIVE', value: word, line: lineIdx + 1, col: pos + 1 });
        } else if (word.toLowerCase() === 'direction') {
          tokens.push({ type: 'DIRECTION_KEYWORD', value: word, line: lineIdx + 1, col: pos + 1 });
        } else if (
          ['TB', 'TD', 'BT', 'RL', 'LR'].includes(upper) &&
          tokens.length > 0 &&
          tokens[tokens.length - 1].line === lineIdx + 1 &&
          (tokens[tokens.length - 1].type === 'DIRECTIVE' ||
            tokens[tokens.length - 1].type === 'DIRECTION_KEYWORD')
        ) {
          tokens.push({ type: 'DIRECTION', value: upper, line: lineIdx + 1, col: pos + 1 });
        } else if (word.toLowerCase() === 'subgraph') {
          tokens.push({ type: 'SUBGRAPH', value: word, line: lineIdx + 1, col: pos + 1 });
        } else if (word.toLowerCase() === 'end') {
          tokens.push({ type: 'END', value: word, line: lineIdx + 1, col: pos + 1 });
        } else if (word === 'linkStyle') {
          tokens.push({ type: 'LINK_STYLE', value: word, line: lineIdx + 1, col: pos + 1 });
        } else if (word === 'style') {
          tokens.push({ type: 'STYLE', value: word, line: lineIdx + 1, col: pos + 1 });
        } else if (word === 'classDef') {
          tokens.push({ type: 'CLASS_DEF', value: word, line: lineIdx + 1, col: pos + 1 });
        } else if (word === 'class') {
          tokens.push({ type: 'CLASS', value: word, line: lineIdx + 1, col: pos + 1 });
        } else {
          tokens.push({ type: 'IDENTIFIER', value: word, line: lineIdx + 1, col: pos + 1 });
        }

        pos = wordEnd;
        continue;
      }

      // Unmatched single character advance
      pos++;
    }

    tokens.push({ type: 'NEWLINE', value: '\n', line: lineIdx + 1, col: rawLine.length + 1 });
  }

  tokens.push({ type: 'EOF', value: '', line: lines.length + 1, col: 1 });
  return tokens;
}





