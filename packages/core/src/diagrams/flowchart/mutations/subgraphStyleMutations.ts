/**
 * Subgraph style AST mutations for Flowchart diagrams
 */

import { MermaidFlowchartAST } from '../types';

export function clearSubgraphStyle(
  ast: MermaidFlowchartAST,
  subgraphId: string
): boolean {
  if (!ast.subgraphs.has(subgraphId)) return false;

  const sub = ast.subgraphs.get(subgraphId)!;
  delete sub.style;

  ast.styles = ast.styles.filter((s) => s.targetId !== subgraphId);
  return true;
}

/**
 * Get the visual style of a subgraph if defined.
 */
export function getSubgraphStyle(
  ast: MermaidFlowchartAST,
  subgraphId: string
): Record<string, string> | undefined {
  const sub = ast.subgraphs.get(subgraphId);
  if (sub?.style && Object.keys(sub.style).length > 0) return sub.style;

  const styleDef = ast.styles.find((s) => s.targetId === subgraphId);
  if (styleDef?.styles && Object.keys(styleDef.styles).length > 0) {
    return styleDef.styles;
  }

  return undefined;
}

/**
 * Update the visual style dictionary of a single subgraph.
 * Mirrors updateNodeStyle but targets subgraphs (emitted as `style <subId> ...`).
 */
export function updateSubgraphStyle(
  ast: MermaidFlowchartAST,
  subgraphId: string,
  styles: Record<string, string> | null
): boolean {
  if (!ast.subgraphs.has(subgraphId)) return false;

  if (!styles || Object.keys(styles).length === 0) {
    return clearSubgraphStyle(ast, subgraphId);
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
    return clearSubgraphStyle(ast, subgraphId);
  }

  const sub = ast.subgraphs.get(subgraphId)!;
  sub.style = cleanStyles;

  // Remove ALL existing entries for subgraphId in ast.styles, add single clean entry
  ast.styles = ast.styles.filter((s) => s.targetId !== subgraphId);
  ast.styles.push({
    type: 'style',
    targetId: subgraphId,
    styles: { ...cleanStyles },
  });

  return true;
}
