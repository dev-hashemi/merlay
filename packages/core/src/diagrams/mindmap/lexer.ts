/**
 * Mindmap Lexer / Line Tokenizer
 */

import { MindmapShape } from './types';

export interface MindmapLineToken {
  type: 'node' | 'icon' | 'class' | 'raw';
  indent: number;
  raw: string;
  explicitId?: string;
  label?: string;
  shape?: MindmapShape;
  icon?: string;
  className?: string;
}

/**
 * Strips surrounding quotes if present: "Label" -> Label
 */
function cleanQuotes(str: string): string {
  const trimmed = str.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function parseMindmapLine(line: string): MindmapLineToken | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  // Measure indentation (treating tab as 2 spaces)
  const leadingWhitespace = line.match(/^[ \t]*/)?.[0] || '';
  let indent = 0;
  for (const ch of leadingWhitespace) {
    indent += ch === '\t' ? 2 : 1;
  }

  // Unmodeled lines: comments & directives
  if (trimmed.startsWith('%%') || /^acc(Title|Descr)\b/i.test(trimmed)) {
    return {
      type: 'raw',
      indent,
      raw: trimmed,
    };
  }

  // Standalone icon line: ::icon(fa fa-book)
  const iconMatch = trimmed.match(/^::icon\(([^)]+)\)$/);
  if (iconMatch) {
    return {
      type: 'icon',
      indent,
      raw: trimmed,
      icon: iconMatch[1].trim(),
    };
  }

  // Standalone class line: :::urgent
  const classOnlyMatch = trimmed.match(/^:::([a-zA-Z0-9_.-]+)$/);
  if (classOnlyMatch) {
    return {
      type: 'class',
      indent,
      raw: trimmed,
      className: classOnlyMatch[1],
    };
  }

  // Parse attached class suffix: Topic:::urgent
  let content = trimmed;
  let attachedClass: string | undefined;
  const classSuffixMatch = content.match(/:::([a-zA-Z0-9_.-]+)$/);
  if (classSuffixMatch) {
    attachedClass = classSuffixMatch[1];
    content = content.slice(0, -classSuffixMatch[0].length).trim();
  }

  // Shape detection:
  // Order matters: check double delimiters before single delimiters

  // 1. Bang: id))label(( or ))label((
  const bangMatch = content.match(/^(?:([a-zA-Z0-9_.-]+)\s*)?\)\)([\s\S]*?)\(\($/);
  if (bangMatch) {
    return {
      type: 'node',
      indent,
      raw: trimmed,
      explicitId: bangMatch[1],
      label: cleanQuotes(bangMatch[2]),
      shape: 'bang',
      className: attachedClass,
    };
  }

  // 2. Cloud: id)label( or )label(
  const cloudMatch = content.match(/^(?:([a-zA-Z0-9_.-]+)\s*)?\)([\s\S]*?)\($/);
  if (cloudMatch) {
    return {
      type: 'node',
      indent,
      raw: trimmed,
      explicitId: cloudMatch[1],
      label: cleanQuotes(cloudMatch[2]),
      shape: 'cloud',
      className: attachedClass,
    };
  }

  // 3. Circle: id((label)) or ((label))
  const circleMatch = content.match(/^(?:([a-zA-Z0-9_.-]+)\s*)?\(\(([\s\S]*?)\)\)$/);
  if (circleMatch) {
    return {
      type: 'node',
      indent,
      raw: trimmed,
      explicitId: circleMatch[1],
      label: cleanQuotes(circleMatch[2]),
      shape: 'circle',
      className: attachedClass,
    };
  }

  // 4. Hexagon: id{{label}} or {{label}}
  const hexMatch = content.match(/^(?:([a-zA-Z0-9_.-]+)\s*)?\{\{([\s\S]*?)\}\}$/);
  if (hexMatch) {
    return {
      type: 'node',
      indent,
      raw: trimmed,
      explicitId: hexMatch[1],
      label: cleanQuotes(hexMatch[2]),
      shape: 'hexagon',
      className: attachedClass,
    };
  }

  // 5. Square / Rect: id[label] or [label]
  const rectMatch = content.match(/^(?:([a-zA-Z0-9_.-]+)\s*)?\[([\s\S]*?)\]$/);
  if (rectMatch) {
    return {
      type: 'node',
      indent,
      raw: trimmed,
      explicitId: rectMatch[1],
      label: cleanQuotes(rectMatch[2]),
      shape: 'rectangle',
      className: attachedClass,
    };
  }

  // 6. Rounded: id(label) or (label)
  const roundMatch = content.match(/^(?:([a-zA-Z0-9_.-]+)\s*)?\(([\s\S]*?)\)$/);
  if (roundMatch) {
    return {
      type: 'node',
      indent,
      raw: trimmed,
      explicitId: roundMatch[1],
      label: cleanQuotes(roundMatch[2]),
      shape: 'rounded',
      className: attachedClass,
    };
  }

  // 7. Default shape: bare text, or explicitId with no delimiters
  return {
    type: 'node',
    indent,
    raw: trimmed,
    label: cleanQuotes(content),
    shape: 'default',
    className: attachedClass,
  };
}
