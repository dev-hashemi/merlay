/**
 * Class Diagram Clipboard / Duplication Mutations
 */

import { generateUniqueId } from '../../common/diagramHeader';
import { ClassNode, ClassRelationship, MermaidClassAST } from '../types';

export function duplicateClasses(
  ast: MermaidClassAST,
  classIds: Iterable<string>
): { nodeIds: string[]; edgeIds: string[] } {
  const selected = new Set(classIds);
  const idMap = new Map<string, string>();
  const newNodeIds: string[] = [];
  const newEdgeIds: string[] = [];

  const existingIds = new Set(ast.classes.keys());

  for (const oldId of selected) {
    const original = ast.classes.get(oldId);
    if (!original) continue;

    const baseName = original.id.replace(/_\d+$/, '');
    const newId = generateUniqueId(existingIds, baseName);
    existingIds.add(newId);
    idMap.set(oldId, newId);
    newNodeIds.push(newId);

    const clonedNode: ClassNode = {
      ...original,
      id: newId,
      label: original.label ? `${original.label} (Copy)` : newId,
      members: original.members.map((m) => ({ ...m })),
      annotations: original.annotations ? [...original.annotations] : [],
      classes: original.classes ? [...original.classes] : [],
      style: original.style ? { ...original.style } : undefined,
    };

    ast.classes.set(newId, clonedNode);

    // If original belonged to a namespace, place clone in the same namespace
    if (original.namespaceId) {
      const ns = ast.namespaces.get(original.namespaceId);
      if (ns) {
        ns.classIds.push(newId);
      }
    }
  }

  // Clone relationships that connect two nodes within the duplicated set
  for (const rel of ast.relationships) {
    if (selected.has(rel.from) && selected.has(rel.to)) {
      const newFrom = idMap.get(rel.from)!;
      const newTo = idMap.get(rel.to)!;
      const newRelId = `rel_${newFrom}_${newTo}_${ast.relationships.length}`;
      newEdgeIds.push(newRelId);

      const clonedRel: ClassRelationship = {
        ...rel,
        id: newRelId,
        from: newFrom,
        to: newTo,
      };
      ast.relationships.push(clonedRel);
    }
  }

  return { nodeIds: newNodeIds, edgeIds: newEdgeIds };
}
