/**
 * Mindmap Clipboard Mutations (Duplication)
 */

import { MermaidMindmapAST, MindmapNode } from '../types';
import { generateUniqueNodeId } from './nodeMutations';

function cloneSubtree(
  ast: MermaidMindmapAST,
  sourceNodeId: string,
  newParentId: string,
  createdNodeIds: string[],
  createdEdgeIds: string[],
  isTopLevel = false
): string {
  const source = ast.nodes.get(sourceNodeId);
  if (!source) return '';

  const newId = generateUniqueNodeId(ast);
  const clonedNode: MindmapNode = {
    ...source,
    id: newId,
    label: isTopLevel ? `${source.label} Copy` : source.label,
    parentId: newParentId,
    children: [],
    explicitId: undefined, // Clear explicit authoring ID to prevent collisions
  };

  ast.nodes.set(newId, clonedNode);
  createdNodeIds.push(newId);
  createdEdgeIds.push(`edge_${newParentId}_${newId}`);

  for (const childId of source.children) {
    const clonedChildId = cloneSubtree(
      ast,
      childId,
      newId,
      createdNodeIds,
      createdEdgeIds,
      false
    );
    if (clonedChildId) {
      clonedNode.children.push(clonedChildId);
    }
  }

  return newId;
}

/**
 * Checks if a node has any ancestor that is also in the given set.
 */
function hasAncestorInSet(
  ast: MermaidMindmapAST,
  nodeId: string,
  set: Set<string>
): boolean {
  let curr = ast.nodes.get(nodeId);
  while (curr && curr.parentId) {
    if (set.has(curr.parentId)) {
      return true;
    }
    curr = ast.nodes.get(curr.parentId);
  }
  return false;
}

/**
 * Duplicates selected topics and their subtrees as siblings under the same parent.
 */
export function duplicateNodes(
  ast: MermaidMindmapAST,
  nodeIds: Iterable<string>
): { nodeIds: string[]; edgeIds: string[] } {
  const createdNodeIds: string[] = [];
  const createdEdgeIds: string[] = [];

  const rawSet = new Set(nodeIds);
  // Filter out root (cannot have multiple roots) and nodes whose ancestors are already selected
  const targets = Array.from(rawSet).filter((id) => {
    if (id === ast.root?.id) return false;
    const node = ast.nodes.get(id);
    if (!node || !node.parentId) return false;
    return !hasAncestorInSet(ast, id, rawSet);
  });

  for (const targetId of targets) {
    const sourceNode = ast.nodes.get(targetId);
    if (!sourceNode || !sourceNode.parentId) continue;

    const parent = ast.nodes.get(sourceNode.parentId);
    if (!parent) continue;

    const clonedRootId = cloneSubtree(
      ast,
      targetId,
      sourceNode.parentId,
      createdNodeIds,
      createdEdgeIds,
      true
    );

    if (clonedRootId) {
      // Place clone right after the original in parent.children
      const origIndex = parent.children.indexOf(targetId);
      if (origIndex >= 0) {
        parent.children.splice(origIndex + 1, 0, clonedRootId);
      } else {
        parent.children.push(clonedRootId);
      }
    }
  }

  return { nodeIds: createdNodeIds, edgeIds: createdEdgeIds };
}
