/**
 * Style parsing and style resolution helpers for Mermaid Flowcharts.
 */

import { ArrowType, MermaidFlowchartAST } from './types';

export function parseStyleDeclarations(fullStr: string): Record<string, string> {
  const styleMap: Record<string, string> = {};
  const chunks: string[] = [];
  let parenDepth = 0;
  let currentChunk = '';

  for (let i = 0; i < fullStr.length; i++) {
    const ch = fullStr[i];
    if (ch === '(') {
      parenDepth++;
      currentChunk += ch;
    } else if (ch === ')') {
      if (parenDepth > 0) parenDepth--;
      currentChunk += ch;
    } else if ((ch === ',' || ch === ';') && parenDepth === 0) {
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
      }
      currentChunk = '';
    } else {
      currentChunk += ch;
    }
  }
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  for (const chunk of chunks) {
    const colonIdx = chunk.indexOf(':');
    if (colonIdx !== -1) {
      const key = chunk.substring(0, colonIdx).trim();
      const val = chunk.substring(colonIdx + 1).trim().replace(/[,;]$/, '');
      if (key && val) {
        styleMap[key] = val;
      }
    }
  }

  return styleMap;
}

export function mapArrowType(raw: string): ArrowType {
  switch (raw) {
    case '-.->':
    case '<-.->':
      return 'dotted';
    case '==>':
    case '<==>':
      return 'thick';
    case '<-->':
      return 'bidirectional';
    case '--x':
      return 'cross';
    case '--o':
      return 'circle';
    case '---':
      return 'open';
    case '-.-':
      return 'dotted_open';
    case '===':
      return 'thick_open';
    case '-->':
    default:
      return 'arrow';
  }
}

export interface PendingLinkStyle {
  targetSpec: string;
  styleMap: Record<string, string>;
}

export function resolveStylesOntoAst(
  ast: MermaidFlowchartAST,
  pendingLinkStyles: PendingLinkStyle[]
): void {
  // 1. Default classDef applies to all nodes that don't have another class or style
  const defaultClass = ast.classDefs.get('default');

  // 2. ClassDef styles apply to nodes having matching classes
  for (const node of ast.nodes.values()) {
    if (node.classes && node.classes.length > 0) {
      for (const cls of node.classes) {
        const cdef = ast.classDefs.get(cls);
        if (cdef?.styles) {
          node.style = { ...(cdef.styles || {}), ...(node.style || {}) };
        }
      }
    } else if (defaultClass?.styles) {
      node.style = { ...(defaultClass.styles || {}), ...(node.style || {}) };
    }
  }

  // 3. Link explicit styles to node definitions (highest precedence)
  for (const s of ast.styles) {
    if (ast.nodes.has(s.targetId)) {
      ast.nodes.get(s.targetId)!.style = {
        ...(ast.nodes.get(s.targetId)!.style || {}),
        ...s.styles,
      };
    }
  }

  // 4. Link styles to edges (linkStyle <indices> <styles>)
  for (const { targetSpec, styleMap } of pendingLinkStyles) {
    if (targetSpec.toLowerCase() === 'default') {
      ast.defaultLinkStyle = { ...(ast.defaultLinkStyle || {}), ...styleMap };
      for (const edge of ast.edges) {
        edge.style = { ...(edge.style || {}), ...styleMap };
      }
    } else {
      const idxStrs = targetSpec.split(',');
      for (const idxStr of idxStrs) {
        const idx = parseInt(idxStr.trim(), 10);
        if (!isNaN(idx) && ast.edges[idx]) {
          ast.edges[idx].style = { ...(ast.edges[idx].style || {}), ...styleMap };
        }
      }
    }
  }
}
