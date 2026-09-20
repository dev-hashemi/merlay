/**
 * Tokenizer & Line Lexer for Mermaid Sequence Diagrams
 */

import {
  ParsedBox,
  ParsedMessage,
  ParsedParticipant,
  parseBoxLine,
  parseMessageLine,
  parseParticipantLine,
  SEQUENCE_ARROWS,
  unquote,
} from './lineParsers';

export type {
  ParsedBox,
  ParsedMessage,
  ParsedParticipant,
};
export {
  parseBoxLine,
  parseMessageLine,
  parseParticipantLine,
  SEQUENCE_ARROWS,
  unquote,
};

export type SequenceTokenType =
  | 'HEADER'
  | 'AUTONUMBER'
  | 'DIRECTIVE'
  | 'COMMENT'
  | 'BOX_START'
  | 'BOX_END'
  | 'PARTICIPANT'
  | 'MESSAGE'
  | 'RAW_LINE'
  | 'EOF';

export interface SequenceToken {
  type: SequenceTokenType;
  value: string;
  line: number;
  message?: ParsedMessage;
  participant?: ParsedParticipant;
  box?: ParsedBox;
}

export function tokenizeSequenceDiagram(input: string): SequenceToken[] {
  const tokens: SequenceToken[] = [];
  const lines = input.split('\n');
  let inAccDescrBlock = false;
  let accDescrLines: string[] = [];
  let inBox = false;

  for (let idx = 0; idx < lines.length; idx++) {
    const rawLine = lines[idx];
    const trimmed = rawLine.trim();

    if (!trimmed) continue;

    // 2. Multi-line accDescr { ... }
    if (!inAccDescrBlock && /^accDescr\s*\{/i.test(trimmed)) {
      inAccDescrBlock = true;
      accDescrLines = [rawLine];
      if (trimmed.endsWith('}')) {
        inAccDescrBlock = false;
        tokens.push({
          type: 'DIRECTIVE',
          value: accDescrLines.join('\n'),
          line: idx,
        });
      }
      continue;
    }
    if (inAccDescrBlock) {
      accDescrLines.push(rawLine);
      if (trimmed.endsWith('}')) {
        inAccDescrBlock = false;
        tokens.push({
          type: 'DIRECTIVE',
          value: accDescrLines.join('\n'),
          line: idx,
        });
      }
      continue;
    }

    // 3. Comments
    if (trimmed.startsWith('%%')) {
      if (trimmed.startsWith('%%{init:')) {
        tokens.push({ type: 'DIRECTIVE', value: rawLine, line: idx });
      } else {
        tokens.push({ type: 'COMMENT', value: rawLine, line: idx });
      }
      continue;
    }

    // 4. Header
    if (/^sequenceDiagram\b/i.test(trimmed)) {
      tokens.push({ type: 'HEADER', value: trimmed, line: idx });
      continue;
    }

    // 5. Autonumber
    if (/^autonumber\b/i.test(trimmed)) {
      tokens.push({ type: 'AUTONUMBER', value: trimmed, line: idx });
      continue;
    }

    // 6. Directives
    if (/^(accTitle|accDescr|title)\b/i.test(trimmed)) {
      tokens.push({ type: 'DIRECTIVE', value: rawLine, line: idx });
      continue;
    }

    // 7. Box Start
    const boxParsed = parseBoxLine(trimmed);
    if (boxParsed) {
      inBox = true;
      tokens.push({
        type: 'BOX_START',
        value: trimmed,
        line: idx,
        box: boxParsed,
      });
      continue;
    }

    // 8. Box End
    if (inBox && /^end\b/i.test(trimmed)) {
      inBox = false;
      tokens.push({
        type: 'BOX_END',
        value: trimmed,
        line: idx,
      });
      continue;
    }

    // 9. Participant or Actor
    const partParsed = parseParticipantLine(trimmed);
    if (partParsed) {
      tokens.push({
        type: 'PARTICIPANT',
        value: trimmed,
        line: idx,
        participant: partParsed,
      });
      continue;
    }

    // 10. Message line
    const msgParsed = parseMessageLine(trimmed);
    if (msgParsed) {
      tokens.push({
        type: 'MESSAGE',
        value: trimmed,
        line: idx,
        message: msgParsed,
      });
      continue;
    }

    // 11. Raw Line (notes, activations, loops, alts, links, etc.)
    tokens.push({
      type: 'RAW_LINE',
      value: rawLine,
      line: idx,
    });
  }

  tokens.push({ type: 'EOF', value: '', line: lines.length });
  return tokens;
}
