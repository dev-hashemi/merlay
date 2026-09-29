/**
 * ClassDef and Class Assignment AST mutations for Mermaid Flowcharts
 */

import { MermaidFlowchartAST } from '../types';

export interface ClassDefDetails {
  name: string;
  styles: Record<string, string>;
}

/**
 * Get all named class definitions (excluding the diagram-level 'default' theme).
 */
export function getClassDefs(ast: MermaidFlowchartAST): ClassDefDetails[] {
  const result: ClassDefDetails[] = [];
  for (const [name, def] of ast.classDefs.entries()) {
    if (name !== 'default') {
      result.push({
        name,
        styles: { ...def.styles },
      });
    }
  }
  return result;
}

/**
 * Define or update a reusable class definition.
 */
export function setClassDef(
  ast: MermaidFlowchartAST,
  name: string,
  styles: Record<string, string>
): void {
  const trimmedName = name.trim();
  if (!trimmedName) return;

  const cleanStyles: Record<string, string> = {};
  for (const [k, v] of Object.entries(styles)) {
    const val = v.trim();
    if (val) {
      cleanStyles[k.trim()] = val;
    }
  }

  if (Object.keys(cleanStyles).length === 0) {
    deleteClassDef(ast, trimmedName);
    return;
  }

  ast.classDefs.set(trimmedName, {
    type: 'classDef',
    name: trimmedName,
    styles: cleanStyles,
  });
}

/**
 * Delete a class definition and detach it from any nodes.
 */
export function deleteClassDef(ast: MermaidFlowchartAST, name: string): void {
  const trimmedName = name.trim();
  ast.classDefs.delete(trimmedName);

  for (const node of ast.nodes.values()) {
    if (node.classes) {
      node.classes = node.classes.filter((c) => c !== trimmedName);
      if (node.classes.length === 0) {
        delete node.classes;
      }
    }
  }
}

/**
 * Get class names assigned to a node.
 */
export function getNodeClasses(
  ast: MermaidFlowchartAST,
  nodeId: string
): string[] {
  const node = ast.nodes.get(nodeId);
  return node?.classes ? [...node.classes] : [];
}

/**
 * Set the list of classes assigned to a node.
 */
export function setNodeClasses(
  ast: MermaidFlowchartAST,
  nodeId: string,
  classes: string[]
): void {
  const node = ast.nodes.get(nodeId);
  if (!node) return;

  const uniqueClasses = Array.from(new Set(classes.map((c) => c.trim()).filter(Boolean)));
  if (uniqueClasses.length > 0) {
    node.classes = uniqueClasses;
    // Clear individual explicit styles so classDef styling is not overridden
    ast.styles = ast.styles.filter((s) => s.targetId !== nodeId);
    delete node.style;
  } else {
    delete node.classes;
  }
}

/**
 * Toggle a class on a node (adds if absent, removes if present).
 */
export function toggleNodeClass(
  ast: MermaidFlowchartAST,
  nodeId: string,
  className: string
): void {
  const current = getNodeClasses(ast, nodeId);
  const trimmed = className.trim();
  if (current.includes(trimmed)) {
    setNodeClasses(
      ast,
      nodeId,
      current.filter((c) => c !== trimmed)
    );
  } else {
    setNodeClasses(ast, nodeId, [...current, trimmed]);
  }
}
