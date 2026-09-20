/**
 * Edge style AST mutations for Flowchart diagrams
 */

import { MermaidFlowchartAST } from '../types';

/**
 * Clear any custom visual style from an edge.
 */
export function clearEdgeStyle(
  ast: MermaidFlowchartAST,
  edgeId: string
): boolean {
  const edge = ast.edges.find((e) => e.id === edgeId);
  if (!edge) return false;
  if (ast.defaultLinkStyle && Object.keys(ast.defaultLinkStyle).length > 0) {
    edge.style = { ...ast.defaultLinkStyle };
  } else {
    delete edge.style;
  }
  return true;
}

/**
 * Update the visual style dictionary of a single edge.
 */
export function updateEdgeStyle(
  ast: MermaidFlowchartAST,
  edgeId: string,
  styles: Record<string, string> | null
): boolean {
  const edge = ast.edges.find((e) => e.id === edgeId);
  if (!edge) return false;

  if (!styles || Object.keys(styles).length === 0) {
    return clearEdgeStyle(ast, edgeId);
  }

  // Clean empty values
  const cleanStyles: Record<string, string> = {};
  for (const [k, v] of Object.entries(styles)) {
    if (v && v.trim()) {
      cleanStyles[k] = v.trim();
    }
  }

  if (Object.keys(cleanStyles).length === 0) {
    return clearEdgeStyle(ast, edgeId);
  }

  edge.style = cleanStyles;
  return true;
}

/**
 * Get the visual style of an edge if defined.
 */
export function getEdgeStyle(
  ast: MermaidFlowchartAST,
  edgeId: string
): Record<string, string> | undefined {
  const edge = ast.edges.find((e) => e.id === edgeId);
  return edge?.style;
}

/**
 * Batch update visual styles for multiple edges.
 */
export function updateEdgesStyle(
  ast: MermaidFlowchartAST,
  edgeIds: Iterable<string>,
  styles: Record<string, string> | null
): number {
  let count = 0;
  for (const id of edgeIds) {
    if (updateEdgeStyle(ast, id, styles)) {
      count++;
    }
  }
  return count;
}

/**
 * Batch clear visual styles from multiple edges.
 */
export function clearEdgesStyle(
  ast: MermaidFlowchartAST,
  edgeIds: Iterable<string>
): number {
  let count = 0;
  for (const id of edgeIds) {
    if (clearEdgeStyle(ast, id)) {
      count++;
    }
  }
  return count;
}
