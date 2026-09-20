/**
 * Class Diagram Namespace / Group Mutations
 */

import { generateUniqueId } from '../../common/diagramHeader';
import { ClassNamespace, MermaidClassAST } from '../types';
import { addClass, deleteClasses } from './nodeMutations';

export function createNamespace(ast: MermaidClassAST, label: string): string {
  const existingIds = new Set(ast.namespaces.keys());
  const nsId = generateUniqueId(existingIds, 'Namespace');

  const ns: ClassNamespace = {
    id: nsId,
    label: label || nsId,
    classIds: [],
  };
  ast.namespaces.set(nsId, ns);

  // Safeguard: Mermaid crashes on empty namespace braces `namespace Name { }`
  // Guarantee at least one initial member class
  addClass(ast, 'Class 1', 'class', nsId);

  return nsId;
}

export function createNamespaceWithMembers(
  ast: MermaidClassAST,
  label: string,
  nodeIds: Iterable<string>
): string {
  const existingIds = new Set(ast.namespaces.keys());
  const nsId = generateUniqueId(existingIds, 'Namespace');

  const ns: ClassNamespace = {
    id: nsId,
    label: label || nsId,
    classIds: [],
  };
  ast.namespaces.set(nsId, ns);

  const ids = Array.from(nodeIds).filter((id) => ast.classes.has(id));
  if (ids.length === 0) {
    addClass(ast, 'Class 1', 'class', nsId);
  } else {
    for (const id of ids) {
      moveClassToNamespace(ast, id, nsId);
    }
  }

  return nsId;
}

export function deleteNamespace(
  ast: MermaidClassAST,
  groupId: string,
  deleteMembers: boolean
): void {
  const ns = ast.namespaces.get(groupId);
  if (!ns) return;

  if (deleteMembers) {
    deleteClasses(ast, [...ns.classIds]);
  } else {
    for (const cid of ns.classIds) {
      const cls = ast.classes.get(cid);
      if (cls) cls.namespaceId = undefined;
    }
  }

  ast.namespaces.delete(groupId);
}

export function renameNamespace(
  ast: MermaidClassAST,
  groupId: string,
  label: string
): void {
  const ns = ast.namespaces.get(groupId);
  if (!ns) return;
  ns.label = label;
}

export function moveClassToNamespace(
  ast: MermaidClassAST,
  classId: string,
  groupId: string | null
): void {
  const cls = ast.classes.get(classId);
  if (!cls) return;

  const oldNsId = cls.namespaceId;
  if (oldNsId && oldNsId !== groupId) {
    const oldNs = ast.namespaces.get(oldNsId);
    if (oldNs) {
      oldNs.classIds = oldNs.classIds.filter((id) => id !== classId);
      // Empty container safeguard: if namespace has no classes left, dissolve it
      if (oldNs.classIds.length === 0) {
        ast.namespaces.delete(oldNsId);
      }
    }
  }

  if (groupId && ast.namespaces.has(groupId)) {
    cls.namespaceId = groupId;
    const newNs = ast.namespaces.get(groupId)!;
    if (!newNs.classIds.includes(classId)) {
      newNs.classIds.push(classId);
    }
  } else {
    cls.namespaceId = undefined;
  }
}

export function moveClassesToNamespace(
  ast: MermaidClassAST,
  classIds: Iterable<string>,
  groupId: string | null
): void {
  for (const id of classIds) {
    moveClassToNamespace(ast, id, groupId);
  }
}
