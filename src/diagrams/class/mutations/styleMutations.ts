/**
 * Class Diagram Style Mutations
 */

import { MermaidClassAST } from '../types';

export function getClassStyle(
  ast: MermaidClassAST,
  classId: string
): Record<string, string> | undefined {
  const cls = ast.classes.get(classId);
  if (cls?.style) return cls.style;
  const def = ast.styles.find((s) => s.targetId === classId);
  return def?.styles;
}

export function updateClassStyle(
  ast: MermaidClassAST,
  classId: string,
  styles: Record<string, string> | null
): void {
  const cls = ast.classes.get(classId);
  if (styles === null) {
    clearClassStyle(ast, classId);
    return;
  }

  if (cls) {
    cls.style = { ...(cls.style || {}), ...styles };
  }

  const existingIdx = ast.styles.findIndex((s) => s.targetId === classId);
  if (existingIdx !== -1) {
    ast.styles[existingIdx].styles = {
      ...ast.styles[existingIdx].styles,
      ...styles,
    };
  } else {
    ast.styles.push({ targetId: classId, styles: { ...styles } });
  }
}

export function updateClassesStyle(
  ast: MermaidClassAST,
  classIds: Iterable<string>,
  styles: Record<string, string> | null
): void {
  for (const id of classIds) {
    updateClassStyle(ast, id, styles);
  }
}

export function clearClassStyle(ast: MermaidClassAST, classId: string): void {
  const cls = ast.classes.get(classId);
  if (cls) {
    delete cls.style;
  }
  ast.styles = ast.styles.filter((s) => s.targetId !== classId);
}

export function clearClassesStyle(
  ast: MermaidClassAST,
  classIds: Iterable<string>
): void {
  for (const id of classIds) {
    clearClassStyle(ast, id);
  }
}

export function getDefaultClassStyle(
  ast: MermaidClassAST
): Record<string, string> | undefined {
  const def = ast.styles.find((s) => s.targetId === 'default');
  return def?.styles;
}

export function updateDefaultClassStyle(
  ast: MermaidClassAST,
  styles: Record<string, string> | null
): void {
  if (styles === null) {
    clearDefaultClassStyle(ast);
    return;
  }
  const existingIdx = ast.styles.findIndex((s) => s.targetId === 'default');
  if (existingIdx !== -1) {
    ast.styles[existingIdx].styles = {
      ...ast.styles[existingIdx].styles,
      ...styles,
    };
  } else {
    ast.styles.push({ targetId: 'default', styles: { ...styles } });
  }
}

export function clearDefaultClassStyle(ast: MermaidClassAST): void {
  ast.styles = ast.styles.filter((s) => s.targetId !== 'default');
}
