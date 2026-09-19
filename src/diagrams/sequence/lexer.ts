/**
 * Tokenizer & Line Lexer for Mermaid Sequence Diagrams
 */

import { SequenceArrowType, SequenceParticipantKind } from './types';

export const SEQUENCE_ARROWS: Array<{ token: string; type: SequenceArrowType }> = [
  { token: '<<-->>', type: 'solid_arrow' },
  { token: '<<->>', type: 'solid_arrow' },
  { token: '-->>', type: 'dotted_arrow' },
  { token: '->>', type: 'solid_arrow' },
  { token: '-->', type: 'dotted_open' },
  { token: '->', type: 'solid_open' },
  { token: '--x', type: 'dotted_cross' },
  { token: '-x', type: 'solid_cross' },
  { token: '--)', type: 'dotted_async' },
  { token: '-)', type: 'solid_async' },
];

export interface ParsedMessage {
  from: string;
  to: string;
  arrow: SequenceArrowType;
  arrowToken: string;
  label: string;
  activateTarget: boolean;
  deactivateSender: boolean;
}

export interface ParsedParticipant {
  id: string;
  label: string;
  kind: SequenceParticipantKind;
}

export interface ParsedBox {
  color?: string;
  label?: string;
  wasQuoted?: boolean;
}

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

function unquote(str: string): string {
  let trimmed = str.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'") && trimmed.length >= 2)
  ) {
    trimmed = trimmed.slice(1, -1);
  }
  return trimmed.replace(/\\"/g, '"').replace(/\\'/g, "'").replace(/\\\\/g, '\\');
}

export function parseParticipantLine(line: string): ParsedParticipant | null {
  const match = line.match(/^(participant|actor)\s+(.+)$/i);
  if (!match) return null;

  const kind: SequenceParticipantKind = match[1].toLowerCase() === 'actor' ? 'actor' : 'participant';
  const rest = match[2].trim();

  // Check for " as "
  const asMatch = rest.match(/^(.*?)\s+as\s+(.*)$/i);
  if (asMatch) {
    const left = asMatch[1].trim();
    const right = asMatch[2].trim();

    // If left is quoted, it's the label and right is the alias/id
    // e.g. participant "Alice Doe" as AD
    if ((left.startsWith('"') || left.startsWith("'")) && !right.startsWith('"') && !right.startsWith("'")) {
      return {
        id: right,
        label: unquote(left),
        kind,
      };
    }

    // Standard form: participant ID as "Label" or participant ID as Label
    return {
      id: unquote(left),
      label: unquote(right),
      kind,
    };
  }

  // No " as ": participant Alice or participant "Alice Doe"
  const unquoted = unquote(rest);
  return {
    id: unquoted,
    label: unquoted,
    kind,
  };
}

export function parseBoxLine(line: string): ParsedBox | null {
  const match = line.match(/^box(?:\s+(.*))?$/i);
  if (!match) return null;

  const rest = match[1]?.trim();
  if (!rest) {
    return { label: undefined, color: undefined };
  }

  // Check if starts with rgb(...) or color word
  // e.g. box rgb(33, 66, 99) Description
  // e.g. box Aqua "Description"
  // e.g. box "Description"
  const rgbMatch = rest.match(/^(rgb\([^)]+\)|rgba\([^)]+\))(?:\s+(.*))?$/i);
  if (rgbMatch) {
    const rawLabel = rgbMatch[2]?.trim();
    const wasQuoted = !!rawLabel && ((rawLabel.startsWith('"') && rawLabel.endsWith('"')) || (rawLabel.startsWith("'") && rawLabel.endsWith("'")));
    return {
      color: rgbMatch[1],
      label: rawLabel ? unquote(rawLabel) : undefined,
      wasQuoted,
    };
  }

  const parts = rest.split(/\s+/);
  // Known colors or transparent
  const firstWord = parts[0];
  const isColor =
    /^(transparent|aqua|aquamarine|azure|beige|bisque|black|blue|blueviolet|brown|burlywood|cadetblue|chartreuse|chocolate|coral|cornflowerblue|cornsilk|crimson|cyan|darkblue|darkcyan|darkgoldenrod|darkgray|darkgreen|darkgrey|darkkhaki|darkmagenta|darkolivegreen|darkorange|darkorchid|darkred|darksalmon|darkseagreen|darkslateblue|darkslategray|darkslategrey|darkturquoise|darkviolet|deeppink|deepskyblue|dimgray|dimgrey|dodgerblue|firebrick|floralwhite|forestgreen|fuchsia|gainsboro|ghostwhite|gold|goldenrod|gray|green|greenyellow|grey|honeydew|hotpink|indianred|indigo|ivory|khaki|lavender|lavenderblush|lawngreen|lemonchiffon|lightblue|lightcoral|lightcyan|lightgoldenrodyellow|lightgray|lightgreen|lightgrey|lightpink|lightsalmon|lightseagreen|lightskyblue|lightslategray|lightslategrey|lightsteelblue|lightyellow|lime|limegreen|linen|magenta|maroon|mediumaquamarine|mediumblue|mediumorchid|mediumpurple|mediumseagreen|mediumslateblue|mediumspringgreen|mediumturquoise|mediumvioletred|midnightblue|mintcream|mistyrose|moccasin|navajowhite|navy|oldlace|olive|olivedrab|orange|orangered|orchid|palegoldenrod|palegreen|paleturquoise|palevioletred|papayawhip|peachpuff|peru|pink|plum|powderblue|purple|rebeccapurple|red|rosybrown|royalblue|saddlebrown|salmon|sandybrown|seagreen|seashell|sienna|silver|skyblue|slateblue|slategray|slategrey|snow|springgreen|steelblue|tan|teal|thistle|tomato|turquoise|violet|wheat|white|whitesmoke|yellow|yellowgreen|#[0-9a-fA-F]{3,8})$/i.test(
      firstWord
    );

  if (isColor && parts.length > 1) {
    const labelPart = rest.slice(firstWord.length).trim();
    const wasQuoted = (labelPart.startsWith('"') && labelPart.endsWith('"')) || (labelPart.startsWith("'") && labelPart.endsWith("'"));
    return {
      color: firstWord,
      label: unquote(labelPart),
      wasQuoted,
    };
  } else if (isColor && parts.length === 1) {
    return {
      color: firstWord,
      label: undefined,
    };
  }

  const wasQuoted = (rest.startsWith('"') && rest.endsWith('"')) || (rest.startsWith("'") && rest.endsWith("'"));
  return {
    color: undefined,
    label: unquote(rest),
    wasQuoted,
  };
}

export function parseMessageLine(line: string): ParsedMessage | null {
  const trimmed = line.trim();
  // Quick guards against known non-messages
  if (
    /^(participant|actor|box|end|note|loop|alt|else|opt|par|and|critical|option|break|rect|activate|deactivate|link|links|autonumber|accTitle|accDescr|title|%%|---)\b/i.test(
      trimmed
    )
  ) {
    return null;
  }

  // Find arrow in the line
  for (const { token, type } of SEQUENCE_ARROWS) {
    const arrowIdx = trimmed.indexOf(token);
    if (arrowIdx <= 0) continue;

    const fromPart = trimmed.slice(0, arrowIdx).trim();
    if (!fromPart) continue;

    let afterArrow = trimmed.slice(arrowIdx + token.length).trim();
    let activateTarget = false;
    let deactivateSender = false;

    // Check for + or -
    if (afterArrow.startsWith('+')) {
      activateTarget = true;
      afterArrow = afterArrow.slice(1).trim();
    } else if (afterArrow.startsWith('-')) {
      deactivateSender = true;
      afterArrow = afterArrow.slice(1).trim();
    }

    if (afterArrow.startsWith('+')) {
      activateTarget = true;
      afterArrow = afterArrow.slice(1).trim();
    } else if (afterArrow.startsWith('-')) {
      deactivateSender = true;
      afterArrow = afterArrow.slice(1).trim();
    }

    // Now split target and label by colon
    let toPart = '';
    let label = '';

    const colonIdx = afterArrow.indexOf(':');
    if (colonIdx >= 0) {
      toPart = afterArrow.slice(0, colonIdx).trim();
      label = afterArrow.slice(colonIdx + 1).trim();
    } else {
      toPart = afterArrow.trim();
      label = '';
    }

    if (!toPart) continue;

    return {
      from: unquote(fromPart),
      to: unquote(toPart),
      arrow: type,
      arrowToken: token,
      label,
      activateTarget,
      deactivateSender,
    };
  }

  return null;
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
