/**
 * Class Diagram Node Mutations
 */

import { generateUniqueId } from '../../common/diagramHeader';
import { ClassKind, ClassNode, ClassRelationship, MermaidClassAST } from '../types';

export * from './memberMutations';

export function addClass(
  ast: MermaidClassAST,
  label: string,
  kind?: ClassKind,
  namespaceId?: string
): string {
  const existingIds = new Set(ast.classes.keys());
  const id = generateUniqueId(existingIds, 'Class');

  const annotations: string[] = [];
  if (kind && kind !== 'class') {
    annotations.push(kind);
  }

  const cls: ClassNode = {
    id,
    label: label || id,
    kind: kind || 'class',
    namespaceId,
    members: [],
    annotations,
  };

  ast.classes.set(id, cls);

  if (namespaceId) {
    const ns = ast.namespaces.get(namespaceId);
    if (ns && !ns.classIds.includes(id)) {
      ns.classIds.push(id);
    }
  }

  return id;
}

export function addChildClass(
  ast: MermaidClassAST,
  parentId: string,
  label: string,
  kind?: ClassKind
): string {
  const parent = ast.classes.get(parentId);
  const childId = addClass(ast, label, kind, parent?.namespaceId);

  // Sprouting in a class diagram establishes inheritance: Parent <|-- Child
  const edgeId = `rel_${parentId}_${childId}_${ast.relationships.length}`;
  const rel: ClassRelationship = {
    id: edgeId,
    from: parentId,
    to: childId,
    leftEnd: '<|',
    lineType: '--',
    rightEnd: undefined,
    rawRelation: '<|--',
  };

  ast.relationships.push(rel);
  return childId;
}

export function deleteClass(ast: MermaidClassAST, classId: string): void {
  ast.classes.delete(classId);

  // Cascade delete incident relationships
  ast.relationships = ast.relationships.filter(
    (rel) => rel.from !== classId && rel.to !== classId
  );

  // Remove from namespaces
  for (const ns of ast.namespaces.values()) {
    ns.classIds = ns.classIds.filter((id) => id !== classId);
  }

  // Remove styles
  ast.styles = ast.styles.filter((s) => s.targetId !== classId);
}

export function deleteClasses(ast: MermaidClassAST, classIds: Iterable<string>): void {
  const toDelete = new Set(classIds);
  for (const id of toDelete) {
    ast.classes.delete(id);
  }
  ast.relationships = ast.relationships.filter(
    (rel) => !toDelete.has(rel.from) && !toDelete.has(rel.to)
  );
  for (const ns of ast.namespaces.values()) {
    ns.classIds = ns.classIds.filter((id) => !toDelete.has(id));
  }
  ast.styles = ast.styles.filter((s) => !toDelete.has(s.targetId));
}

export function updateClassLabel(
  ast: MermaidClassAST,
  classId: string,
  label: string
): void {
  const cls = ast.classes.get(classId);
  if (!cls) return;
  cls.label = label;
}

export function isClassTextEditable(_cls?: ClassNode): boolean {
  return true;
}

export function updateClassKind(
  ast: MermaidClassAST,
  classId: string,
  kind: string
): void {
  const cls = ast.classes.get(classId);
  if (!cls) return;
  cls.kind = kind as ClassKind;
  if (kind === 'class') {
    cls.annotations = [];
  } else {
    cls.annotations = [kind];
  }
}

export function updateClassesKind(
  ast: MermaidClassAST,
  classIds: Iterable<string>,
  kind: string
): void {
  for (const id of classIds) {
    updateClassKind(ast, id, kind);
  }
}
