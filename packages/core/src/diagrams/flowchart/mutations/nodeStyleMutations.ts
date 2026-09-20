/**
 * Node style AST mutations for Flowchart diagrams
 */

import { MermaidFlowchartAST } from '../types';

export function clearNodeStyle(
  ast: MermaidFlowchartAST,
  nodeId: string
): boolean {
  if (!ast.nodes.has(nodeId)) return false;

  const node = ast.nodes.get(nodeId)!;

  // Clear class bindings so the node is completely reset to diagram default
  node.classes = undefined;

  ast.styles = ast.styles.filter((s) => s.targetId !== nodeId);

  // If there is a diagram default (classDef default), apply it to node.style
  // so the view model and overlays reflect the default theme!
  const defaultClass = ast.classDefs.get('default');
  if (defaultClass?.styles && Object.keys(defaultClass.styles).length > 0) {
    node.style = { ...defaultClass.styles };
  } else {
    delete node.style;
  }

  return true;
}

export function updateNodeStyle(
  ast: MermaidFlowchartAST,
  nodeId: string,
  styles: Record<string, string> | null
): boolean {
  if (!ast.nodes.has(nodeId)) return false;

  const node = ast.nodes.get(nodeId)!;

  if (!styles || Object.keys(styles).length === 0) {
    return clearNodeStyle(ast, nodeId);
  }

  // Clean empty values
  const cleanStyles: Record<string, string> = {};
  for (const [k, v] of Object.entries(styles)) {
    const trimmed = v.trim();
    if (trimmed) {
      cleanStyles[k.trim()] = trimmed;
    }
  }

  if (Object.keys(cleanStyles).length === 0) {
    return clearNodeStyle(ast, nodeId);
  }

  // Update on node
  node.style = cleanStyles;

  // Detach any previous class bindings so the new explicit style takes full effect
  node.classes = undefined;

  // Remove ALL existing entries for nodeId in ast.styles, and add the single new clean entry
  ast.styles = ast.styles.filter((s) => s.targetId !== nodeId);
  ast.styles.push({
    type: 'style',
    targetId: nodeId,
    styles: { ...cleanStyles },
  });

  return true;
}

export function getNodeStyle(
  ast: MermaidFlowchartAST,
  nodeId: string
): Record<string, string> | undefined {
  const node = ast.nodes.get(nodeId);
  if (node?.style && Object.keys(node.style).length > 0) return node.style;

  const styleDef = ast.styles.find((s) => s.targetId === nodeId);
  if (styleDef?.styles && Object.keys(styleDef.styles).length > 0) {
    return styleDef.styles;
  }

  // Fallback to styles from classes assigned to the node
  if (node?.classes && node.classes.length > 0) {
    const combined: Record<string, string> = {};
    for (const cls of node.classes) {
      const cdef = ast.classDefs.get(cls);
      if (cdef?.styles) {
        Object.assign(combined, cdef.styles);
      }
    }
    if (Object.keys(combined).length > 0) {
      return combined;
    }
  }

  // Fallback to default classDef if defined
  const defaultClass = ast.classDefs.get('default');
  if (defaultClass?.styles && Object.keys(defaultClass.styles).length > 0) {
    return defaultClass.styles;
  }

  return undefined;
}

/**
 * Batch update visual styles for multiple nodes.
 */
export function updateNodesStyle(
  ast: MermaidFlowchartAST,
  nodeIds: Iterable<string>,
  styles: Record<string, string> | null
): number {
  let count = 0;
  for (const id of nodeIds) {
    if (updateNodeStyle(ast, id, styles)) {
      count++;
    }
  }
  return count;
}

/**
 * Batch clear visual styles for multiple nodes.
 */
export function clearNodesStyle(
  ast: MermaidFlowchartAST,
  nodeIds: Iterable<string>
): number {
  let count = 0;
  for (const id of nodeIds) {
    if (clearNodeStyle(ast, id)) {
      count++;
    }
  }
  return count;
}
