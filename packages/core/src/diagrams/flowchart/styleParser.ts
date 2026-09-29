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

export interface ArrowDetails {
  arrowType: ArrowType;
  length: number;
}

export function parseArrowDetails(raw: string): ArrowDetails {
  // 1. Invisible edges (~~~, ~~~~, ~~~~~)
  if (raw.startsWith('~')) {
    return {
      arrowType: 'invisible',
      length: Math.max(1, raw.length - 2),
    };
  }

  // 2. Bidirectional Circle (o--o, o---o, etc.)
  if (raw.startsWith('o-') && raw.endsWith('o')) {
    return {
      arrowType: 'circle_bidirectional',
      length: Math.max(1, raw.length - 3),
    };
  }

  // 3. Bidirectional Cross (x--x, x---x, etc.)
  if (raw.startsWith('x-') && raw.endsWith('x')) {
    return {
      arrowType: 'cross_bidirectional',
      length: Math.max(1, raw.length - 3),
    };
  }

  // 4. Single Circle head (--o, ---o, etc.) or tail (o--, o---)
  if (raw.endsWith('o') || raw.startsWith('o-')) {
    return {
      arrowType: 'circle',
      length: Math.max(1, raw.length - 2),
    };
  }

  // 5. Single Cross head (--x, ---x, etc.) or tail (x--, x---)
  if (raw.endsWith('x') || raw.startsWith('x-')) {
    return {
      arrowType: 'cross',
      length: Math.max(1, raw.length - 2),
    };
  }

  // 6. Thick edges (==>, <==>, ===, etc.)
  if (raw.includes('=')) {
    if (raw.startsWith('<') && raw.endsWith('>')) {
      return {
        arrowType: 'thick',
        length: Math.max(1, raw.length - 3),
      };
    }
    if (raw.endsWith('>')) {
      return {
        arrowType: 'thick',
        length: Math.max(1, raw.length - 2),
      };
    }
    return {
      arrowType: 'thick_open',
      length: Math.max(1, raw.length - 2),
    };
  }

  // 7. Dotted edges (-.->, <-.->, -.-, etc.)
  if (raw.includes('.')) {
    const dotCount = (raw.match(/\./g) || []).length;
    if (raw.endsWith('>')) {
      return {
        arrowType: 'dotted',
        length: Math.max(1, dotCount),
      };
    }
    return {
      arrowType: 'dotted_open',
      length: Math.max(1, dotCount),
    };
  }

  // 8. Bidirectional standard (<-->, <--->)
  if (raw.startsWith('<') && raw.endsWith('>')) {
    return {
      arrowType: 'bidirectional',
      length: Math.max(1, raw.length - 3),
    };
  }

  // 9. Standard arrow (--> or -> or --->)
  if (raw.endsWith('>')) {
    if (raw === '->') return { arrowType: 'arrow', length: 1 };
    return {
      arrowType: 'arrow',
      length: Math.max(1, raw.length - 2),
    };
  }

  // 10. Open line (---, ----, -----)
  return {
    arrowType: 'open',
    length: Math.max(1, raw.length - 2),
  };
}

export function mapArrowType(raw: string): ArrowType {
  return parseArrowDetails(raw).arrowType;
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
