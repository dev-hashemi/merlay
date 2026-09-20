/**
 * Mindmap Tree & Connection Mutations
 *
 * Mindmaps represent tree hierarchies. Dragging an edge from Topic A to Topic B
 * represents Reparenting (making Topic B a child of Topic A), with cycle prevention.
 */

import { MermaidMindmapAST, MindmapNode } from '../types';
import { deleteNode, generateUniqueNodeId } from './nodeMutations';

/**
 * Returns true if potentialChildId is a descendant of potentialAncestorId.
 */
export function isDescendant(
  ast: MermaidMindmapAST,
  potentialChildId: string,
  potentialAncestorId: string
): boolean {
  let curr = ast.nodes.get(potentialChildId);
  while (curr && curr.parentId) {
    if (curr.parentId === potentialAncestorId) {
      return true;
    }
    curr = ast.nodes.get(curr.parentId);
  }
  return false;
}

/**
 * Checks whether dropping a connection from fromId onto toId is legal.
 * fromId is the new parent, toId is the child node to reparent.
 */
export function canConnect(
  ast: MermaidMindmapAST,
  fromId: string,
  toId: string
): boolean {
  if (!ast.nodes.has(fromId) || !ast.nodes.has(toId)) {
    return false;
  }
  if (fromId === toId) {
    return false;
  }
  // Root node can never become a child of another node
  if (toId === ast.root?.id) {
    return false;
  }
  // Cycle prevention: toId cannot be an ancestor of fromId
  if (isDescendant(ast, fromId, toId)) {
    return false;
  }
  // If already a child of fromId, no-op
  const child = ast.nodes.get(toId);
  if (child?.parentId === fromId) {
    return false;
  }

  return true;
}

/**
 * Reparents toId under fromId.
 */
export function connect(
  ast: MermaidMindmapAST,
  fromId: string,
  toId: string
): void {
  if (!canConnect(ast, fromId, toId)) {
    return;
  }

  const child = ast.nodes.get(toId);
  const newParent = ast.nodes.get(fromId);
  if (!child || !newParent) return;

  // Detach from previous parent
  if (child.parentId) {
    const oldParent = ast.nodes.get(child.parentId);
    if (oldParent) {
      oldParent.children = oldParent.children.filter((id) => id !== toId);
    }
  }

  child.parentId = fromId;
  newParent.children.push(toId);
}

/**
 * Resolves an edgeId to { parentId, childId }.
 */
export function findEdgeEndpoints(
  ast: MermaidMindmapAST,
  edgeId: string
): { parentId: string; childId: string } | null {
  for (const node of ast.nodes.values()) {
    if (node.parentId && `edge_${node.parentId}_${node.id}` === edgeId) {
      return { parentId: node.parentId, childId: node.id };
    }
  }
  return null;
}

/**
 * Deleting a branch in a mindmap deletes the child subtree.
 */
export function deleteEdge(ast: MermaidMindmapAST, edgeId: string): void {
  const endpoints = findEdgeEndpoints(ast, edgeId);
  if (!endpoints) return;
  deleteNode(ast, endpoints.childId);
}

/**
 * Batch delete edges.
 */
export function deleteEdges(
  ast: MermaidMindmapAST,
  edgeIds: Iterable<string>
): void {
  for (const edgeId of edgeIds) {
    deleteEdge(ast, edgeId);
  }
}

/**
 * Inserts an intermediate node on an edge between parent and child.
 */
export function insertNodeOnEdge(
  ast: MermaidMindmapAST,
  edgeId: string,
  label: string
): string | null {
  const endpoints = findEdgeEndpoints(ast, edgeId);
  if (!endpoints) return null;

  const parent = ast.nodes.get(endpoints.parentId);
  const child = ast.nodes.get(endpoints.childId);
  if (!parent || !child) return null;

  const newId = generateUniqueNodeId(ast);
  const newNode: MindmapNode = {
    id: newId,
    label: label.trim() || 'Topic',
    shape: 'default',
    parentId: parent.id,
    children: [child.id],
  };

  // Replace child with new node in parent.children preserving index
  const idx = parent.children.indexOf(child.id);
  if (idx >= 0) {
    parent.children.splice(idx, 1, newId);
  } else {
    parent.children.push(newId);
  }

  child.parentId = newId;
  ast.nodes.set(newId, newNode);

  return newId;
}
