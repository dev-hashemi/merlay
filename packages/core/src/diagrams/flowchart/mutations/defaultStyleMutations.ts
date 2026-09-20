/**
 * Default style AST mutations for Flowchart diagrams (classDef default & linkStyle default)
 */

import { MermaidFlowchartAST } from '../types';

export function getDefaultNodeStyle(
  ast: MermaidFlowchartAST
): Record<string, string> | undefined {
  return ast.classDefs.get('default')?.styles;
}

/**
 * Set the diagram-level default node style (classDef default).
 */
export function updateDefaultNodeStyle(
  ast: MermaidFlowchartAST,
  styles: Record<string, string> | null
): boolean {
  if (!styles || Object.keys(styles).length === 0) {
    return clearDefaultNodeStyle(ast);
  }

  const cleanStyles: Record<string, string> = {};
  for (const [k, v] of Object.entries(styles)) {
    if (typeof v === 'string') {
      const trimmed = v.trim();
      if (trimmed) {
        cleanStyles[k.trim()] = trimmed;
      }
    }
  }

  if (Object.keys(cleanStyles).length === 0) {
    return clearDefaultNodeStyle(ast);
  }

  ast.classDefs.set('default', {
    type: 'classDef',
    name: 'default',
    styles: cleanStyles,
  });

  // Apply default styles to all nodes that don't have an explicit style or class override
  const explicitStyleTargets = new Set(ast.styles.map((s) => s.targetId));
  for (const [id, node] of ast.nodes.entries()) {
    if (!explicitStyleTargets.has(id) && (!node.classes || node.classes.length === 0)) {
      node.style = { ...cleanStyles };
    }
  }

  return true;
}

/**
 * Clear the diagram-level default node style.
 */
export function clearDefaultNodeStyle(ast: MermaidFlowchartAST): boolean {
  const had = ast.classDefs.delete('default');
  const explicitStyleTargets = new Set(ast.styles.map((s) => s.targetId));
  for (const [id, node] of ast.nodes.entries()) {
    if (!explicitStyleTargets.has(id) && (!node.classes || node.classes.length === 0)) {
      delete node.style;
    }
  }
  return had;
}

/**
 * Get the diagram-level default edge style (linkStyle default).
 */
export function getDefaultEdgeStyle(
  ast: MermaidFlowchartAST
): Record<string, string> | undefined {
  return ast.defaultLinkStyle;
}

/**
 * Set the diagram-level default edge style (linkStyle default).
 */
export function updateDefaultEdgeStyle(
  ast: MermaidFlowchartAST,
  styles: Record<string, string> | null
): boolean {
  if (!styles || Object.keys(styles).length === 0) {
    return clearDefaultEdgeStyle(ast);
  }

  const cleanStyles: Record<string, string> = {};
  for (const [k, v] of Object.entries(styles)) {
    if (typeof v === 'string') {
      const trimmed = v.trim();
      if (trimmed) {
        cleanStyles[k.trim()] = trimmed;
      }
    }
  }

  if (Object.keys(cleanStyles).length === 0) {
    return clearDefaultEdgeStyle(ast);
  }

  const prevDefault = ast.defaultLinkStyle;
  ast.defaultLinkStyle = cleanStyles;

  for (const edge of ast.edges) {
    if (
      !edge.style ||
      Object.keys(edge.style).length === 0 ||
      (prevDefault &&
        Object.keys(edge.style).length === Object.keys(prevDefault).length &&
        Object.entries(edge.style).every(([k, v]) => prevDefault[k] === v))
    ) {
      edge.style = { ...cleanStyles };
    }
  }

  return true;
}

/**
 * Clear the diagram-level default edge style.
 */
export function clearDefaultEdgeStyle(ast: MermaidFlowchartAST): boolean {
  const prevDefault = ast.defaultLinkStyle;
  const had = Boolean(prevDefault);
  delete ast.defaultLinkStyle;
  if (prevDefault) {
    for (const edge of ast.edges) {
      if (
        edge.style &&
        Object.keys(edge.style).length === Object.keys(prevDefault).length &&
        Object.entries(edge.style).every(([k, v]) => prevDefault[k] === v)
      ) {
        delete edge.style;
      }
    }
  }
  return had;
}
