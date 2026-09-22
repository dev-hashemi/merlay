/**
 * Class Diagram Lexer and Line Tokenizer
 */

import { ClassDirection, ClassMember } from './types';

export type ClassLineTokenType =
  | 'header'
  | 'direction'
  | 'namespace_start'
  | 'class_block_start'
  | 'block_end'
  | 'class_decl'
  | 'stereotype'
  | 'member_single'
  | 'relationship'
  | 'style'
  | 'raw';

export interface ClassTokenRelationship {
  from: string;
  leftCardinality?: string;
  leftEnd?: string;
  lineType: '--' | '..';
  rightEnd?: string;
  rightCardinality?: string;
  to: string;
  label?: string;
  rawRelation: string;
}

export interface ClassLineToken {
  type: ClassLineTokenType;
  raw: string;
  headerType?: 'classDiagram' | 'classDiagram-v2';
  direction?: ClassDirection;
  namespaceId?: string;
  classId?: string;
  classLabel?: string;
  classStyle?: string;
  stereotype?: string;
  targetId?: string;
  member?: ClassMember;
  relationship?: ClassTokenRelationship;
  styleDeclaration?: {
    targetId: string;
    styleString: string;
  };
}

export function parseMemberLine(line: string): ClassMember {
  const trimmed = line.trim();
  let vis: '+' | '-' | '#' | '~' | undefined;
  let text = trimmed;

  const firstChar = trimmed[0];
  if (['+', '-', '#', '~'].includes(firstChar)) {
    vis = firstChar as '+' | '-' | '#' | '~';
    text = trimmed.slice(1).trim();
  }

  let classifier: '*' | '$' | undefined;
  if (text.endsWith('*')) {
    classifier = '*';
  } else if (text.endsWith('$')) {
    classifier = '$';
  }

  return {
    raw: trimmed,
    visibility: vis,
    classifier,
    text,
  };
}

const RELATION_REGEX = /^([A-Za-z0-9_~`-]+|"[^"]+")\s*(?:"([^"]*)")?\s*(<\||\*|o|<)?(--|\.\.)(\|>|\*|o|>)?\s*(?:"([^"]*)")?\s*([A-Za-z0-9_~`-]+|"[^"]+")(?:\s*:\s*(.+))?$/;

function cleanId(id: string): string {
  const t = id.trim();
  if (t.startsWith('"') && t.endsWith('"')) {
    return t.slice(1, -1);
  }
  return t;
}

export function parseClassLine(line: string): ClassLineToken {
  const trimmed = line.trim();

  // 0. Explicit unmodeled raw lines (comments, directives, notes, classDef, click, link)
  if (
    trimmed.startsWith('%%') ||
    /^acc(Title|Descr)\b/i.test(trimmed) ||
    /^note\b/i.test(trimmed) ||
    /^classDef\b/i.test(trimmed) ||
    /^cssClass\b/i.test(trimmed) ||
    /^(link|click|callback)\b/i.test(trimmed)
  ) {
    return {
      type: 'raw',
      raw: trimmed,
    };
  }

  // 1. Diagram header
  const headerMatch = trimmed.match(/^(classDiagram(-v2)?)\b/i);
  if (headerMatch) {
    return {
      type: 'header',
      raw: trimmed,
      headerType: headerMatch[1].toLowerCase() === 'classdiagram-v2' ? 'classDiagram-v2' : 'classDiagram',
    };
  }

  // 2. Direction
  const dirMatch = trimmed.match(/^direction\s+(TB|BT|LR|RL)\b/i);
  if (dirMatch) {
    return {
      type: 'direction',
      raw: trimmed,
      direction: dirMatch[1].toUpperCase() as ClassDirection,
    };
  }

  // 3. Namespace start
  const nsMatch = trimmed.match(/^namespace\s+([A-Za-z0-9_~`-]+)\s*\{$/);
  if (nsMatch) {
    return {
      type: 'namespace_start',
      raw: trimmed,
      namespaceId: cleanId(nsMatch[1]),
    };
  }

  // 4. Block end
  if (trimmed === '}') {
    return {
      type: 'block_end',
      raw: trimmed,
    };
  }

  // 5. Class block start: class Name["Label"] { or class Name { or class Name:::style {
  const classBlockMatch = trimmed.match(/^class\s+([A-Za-z0-9_~`-]+)(?:\["([^"]*)"\])?(?:::([A-Za-z0-9_-]+))?\s*\{$/);
  if (classBlockMatch) {
    return {
      type: 'class_block_start',
      raw: trimmed,
      classId: cleanId(classBlockMatch[1]),
      classLabel: classBlockMatch[2],
      classStyle: classBlockMatch[3],
    };
  }

  // 6. Relationship line
  const relMatch = trimmed.match(RELATION_REGEX);
  // Ensure it's not a single-line member declaration (e.g. `Class : +member` has no arrow token)
  if (relMatch && (relMatch[3] || relMatch[4] || relMatch[5])) {
    const left = relMatch[3] || '';
    const line = relMatch[4] as '--' | '..';
    const right = relMatch[5] || '';
    return {
      type: 'relationship',
      raw: trimmed,
      relationship: {
        from: cleanId(relMatch[1]),
        leftCardinality: relMatch[2],
        leftEnd: left || undefined,
        lineType: line,
        rightEnd: right || undefined,
        rightCardinality: relMatch[6],
        to: cleanId(relMatch[7]),
        label: relMatch[8]?.trim(),
        rawRelation: `${left}${line}${right}`,
      },
    };
  }

  // 7. Explicit class declaration: class Name["Label"] or class Name:::style or class Name
  const classDeclMatch = trimmed.match(/^class\s+([A-Za-z0-9_~`-]+)(?:\["([^"]*)"\])?(?:::([A-Za-z0-9_-]+))?$/);
  if (classDeclMatch) {
    return {
      type: 'class_decl',
      raw: trimmed,
      classId: cleanId(classDeclMatch[1]),
      classLabel: classDeclMatch[2],
      classStyle: classDeclMatch[3],
    };
  }

  // 8. Stereotype: <<interface>> Shape or <<service>> Shape
  const stereoMatch = trimmed.match(/^<<([A-Za-z0-9_-]+)>>\s+([A-Za-z0-9_~`-]+)$/);
  if (stereoMatch) {
    return {
      type: 'stereotype',
      raw: trimmed,
      stereotype: stereoMatch[1],
      targetId: cleanId(stereoMatch[2]),
    };
  }

  // 9. Single-line member: ClassName : +member
  const memberMatch = trimmed.match(/^([A-Za-z0-9_~`-]+)\s*:\s*(.+)$/);
  if (memberMatch) {
    return {
      type: 'member_single',
      raw: trimmed,
      classId: cleanId(memberMatch[1]),
      member: parseMemberLine(memberMatch[2]),
    };
  }

  // 10. Style: style ClassName fill:#f9f,stroke:#333
  const styleMatch = trimmed.match(/^style\s+([A-Za-z0-9_~`-]+)\s+(.+)$/);
  if (styleMatch) {
    return {
      type: 'style',
      raw: trimmed,
      styleDeclaration: {
        targetId: cleanId(styleMatch[1]),
        styleString: styleMatch[2].trim().replace(/;$/, ''),
      },
    };
  }

  // 11. Unmodeled / raw line (comments %%, accTitle, accDescr, note, classDef, click, link...)
  return {
    type: 'raw',
    raw: trimmed,
  };
}
