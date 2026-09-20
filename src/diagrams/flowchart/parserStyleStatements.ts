/**
 * Style, classDef, linkStyle, and class assignment statement parsers for Mermaid Flowcharts.
 */

import { Token } from './lexer';
import { MermaidFlowchartAST } from './types';
import { parseStyleDeclarations, PendingLinkStyle } from './styleParser';
import { ensureNodeInAst } from './parserNodes';

export function parseStyleStatement(
  tokens: readonly Token[],
  cursor: number,
  ast: MermaidFlowchartAST
): number {
  let cur = cursor + 1; // consume 'style'
  const lineTokens: Token[] = [];
  while (cur < tokens.length && tokens[cur].type !== 'NEWLINE' && tokens[cur].type !== 'EOF') {
    lineTokens.push(tokens[cur]);
    cur++;
  }

  const fullLine = lineTokens.map((t) => t.value).join(' ').trim();
  const firstColon = fullLine.indexOf(':');
  if (firstColon !== -1) {
    const beforeColon = fullLine.substring(0, firstColon);
    const lastSpace = beforeColon.lastIndexOf(' ');
    let targetsStr = '';
    let styleStr = '';

    if (lastSpace !== -1) {
      targetsStr = beforeColon.substring(0, lastSpace).trim();
      styleStr = fullLine.substring(lastSpace + 1).trim();
    } else {
      targetsStr = beforeColon.trim();
      styleStr = fullLine.substring(firstColon + 1).trim();
    }

    const styleMap = parseStyleDeclarations(styleStr);
    const targetIds = targetsStr
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);

    for (const targetId of targetIds) {
      if (targetId.toLowerCase() === 'default') {
        if (!ast.classDefs.has('default')) {
          ast.classDefs.set('default', {
            type: 'classDef',
            name: 'default',
            styles: { ...styleMap },
          });
        } else {
          Object.assign(ast.classDefs.get('default')!.styles, styleMap);
        }
      } else {
        const existingStyleIndex = ast.styles.findIndex(
          (s) => s.targetId === targetId
        );
        if (existingStyleIndex !== -1) {
          ast.styles[existingStyleIndex].styles = {
            ...ast.styles[existingStyleIndex].styles,
            ...styleMap,
          };
        } else {
          ast.styles.push({
            type: 'style',
            targetId,
            styles: { ...styleMap },
          });
        }

        if (ast.nodes.has(targetId)) {
          ast.nodes.get(targetId)!.style = {
            ...(ast.nodes.get(targetId)!.style || {}),
            ...styleMap,
          };
        }
        if (ast.subgraphs.has(targetId)) {
          ast.subgraphs.get(targetId)!.style = {
            ...(ast.subgraphs.get(targetId)!.style || {}),
            ...styleMap,
          };
        }
      }
    }
  }

  return cur;
}

export function parseLinkStyleStatement(
  tokens: readonly Token[],
  cursor: number,
  pendingLinkStyles: PendingLinkStyle[]
): number {
  let cur = cursor + 1; // consume 'linkStyle'
  const parts: string[] = [];
  while (cur < tokens.length && tokens[cur].type !== 'NEWLINE' && tokens[cur].type !== 'EOF') {
    parts.push(tokens[cur].value);
    cur++;
  }

  const fullStr = parts.join(' ').trim();
  const tokensList = fullStr.split(/\s+/);
  const targetParts: string[] = [];
  const styleTokens: string[] = [];
  let foundStyle = false;

  for (const t of tokensList) {
    if (!foundStyle && !t.includes(':')) {
      targetParts.push(t);
    } else {
      foundStyle = true;
      styleTokens.push(t);
    }
  }

  const targetSpec = targetParts.join('').replace(/;$/, '');
  const stylesStr = styleTokens.join(' ');
  const styleMap = parseStyleDeclarations(stylesStr);

  pendingLinkStyles.push({ targetSpec, styleMap });
  return cur;
}

export function parseClassDefStatement(
  tokens: readonly Token[],
  cursor: number,
  ast: MermaidFlowchartAST
): number {
  let cur = cursor + 1; // consume 'classDef'
  if (tokens[cur]?.type === 'IDENTIFIER') {
    const className = tokens[cur].value;
    cur++;
    const styleParts: string[] = [];

    while (cur < tokens.length && tokens[cur].type !== 'NEWLINE' && tokens[cur].type !== 'EOF') {
      styleParts.push(tokens[cur].value);
      cur++;
    }

    const fullStr = styleParts.join(' ');
    const styleMap = parseStyleDeclarations(fullStr);

    ast.classDefs.set(className, {
      type: 'classDef',
      name: className,
      styles: styleMap,
    });
  }
  return cur;
}

export function parseClassAssignmentStatement(
  tokens: readonly Token[],
  cursor: number,
  ast: MermaidFlowchartAST,
  currentSubId: string | undefined
): number {
  let cur = cursor + 1; // consume 'class'
  const classTokens: Token[] = [];
  while (cur < tokens.length && tokens[cur].type !== 'NEWLINE' && tokens[cur].type !== 'EOF') {
    classTokens.push(tokens[cur]);
    cur++;
  }

  const fullLine = classTokens
    .map((t) => t.value)
    .join(' ')
    .trim()
    .replace(/;$/, '');
  const words = fullLine.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    const className = words[words.length - 1].trim();
    const targetsRaw = words.slice(0, words.length - 1).join(' ');
    const targetIds = targetsRaw
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);

    for (const targetId of targetIds) {
      if (!ast.nodes.has(targetId)) {
        ensureNodeInAst(ast, currentSubId, { id: targetId });
      }
      const node = ast.nodes.get(targetId);
      if (node) {
        node.classes = Array.from(
          new Set([...(node.classes || []), className])
        );
      }
    }
  }

  return cur;
}
