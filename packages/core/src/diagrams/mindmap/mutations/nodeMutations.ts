/**
 * Mindmap Node Mutations
 */

import { MermaidMindmapAST, MindmapNode, MindmapShape } from '../types';

export function generateUniqueNodeId(
  ast: MermaidMindmapAST,
  basePrefix = 'node'
): string {
  let counter = ast.nodes.size + 1;
  let id = `${basePrefix}_${counter}`;
  while (ast.nodes.has(id)) {
    counter++;
    id = `${basePrefix}_${counter}`;
  }
  return id;
}

/**
 * Adds a new topic under the root node.
 * If the diagram has no root, creates the root node.
 */
export function addNode(ast: MermaidMindmapAST, label: string): string {
  if (!ast.root) {
    const rootId = 'root';
    const rootNode: MindmapNode = {
      id: rootId,
      label: label.trim() || 'Central Topic',
      shape: 'circle',
      parentId: null,
      children: [],
      explicitId: rootId,
    };
    ast.root = rootNode;
    ast.nodes.set(rootId, rootNode);
    return rootId;
  }

  return addChildNode(ast, ast.root.id, label);
}

/**
 * Adds a subtopic under parentId.
 */
export function addChildNode(
  ast: MermaidMindmapAST,
  parentId: string,
  label: string
): string {
  const parentNode = ast.nodes.get(parentId) || ast.root;
  if (!parentNode) {
    return addNode(ast, label);
  }

  const newId = generateUniqueNodeId(ast);
  const newNode: MindmapNode = {
    id: newId,
    label: label.trim() || 'Subtopic',
    shape: 'default',
    parentId: parentNode.id,
    children: [],
  };

  parentNode.children.push(newId);
  ast.nodes.set(newId, newNode);
  return newId;
}

/**
 * Recursively deletes a node and all of its descendants.
 */
export function deleteNode(ast: MermaidMindmapAST, nodeId: string): void {
  const node = ast.nodes.get(nodeId);
  if (!node) return;

  // Detach from parent
  if (node.parentId) {
    const parent = ast.nodes.get(node.parentId);
    if (parent) {
      parent.children = parent.children.filter((id) => id !== nodeId);
    }
  }

  // Collect descendants
  const toDelete = new Set<string>();
  function collect(id: string) {
    toDelete.add(id);
    const n = ast.nodes.get(id);
    if (!n) return;
    for (const childId of n.children) {
      collect(childId);
    }
  }
  collect(nodeId);

  for (const id of toDelete) {
    ast.nodes.delete(id);
  }

  if (ast.root && toDelete.has(ast.root.id)) {
    ast.root = null;
  }

  // If entire diagram is empty, reset to clean default root
  if (ast.nodes.size === 0 || !ast.root) {
    const defaultRoot: MindmapNode = {
      id: 'root',
      label: 'Central Topic',
      shape: 'circle',
      parentId: null,
      children: [],
      explicitId: 'root',
    };
    ast.root = defaultRoot;
    ast.nodes.set('root', defaultRoot);
  }
}

/**
 * Batch delete nodes.
 */
export function deleteNodes(
  ast: MermaidMindmapAST,
  nodeIds: Iterable<string>
): void {
  for (const id of nodeIds) {
    if (ast.nodes.has(id)) {
      deleteNode(ast, id);
    }
  }
}

/**
 * Updates the text label of a topic.
 */
export function updateNodeLabel(
  ast: MermaidMindmapAST,
  nodeId: string,
  label: string
): void {
  const node = ast.nodes.get(nodeId);
  if (!node) return;
  node.label = label;
}

/**
 * Mindmap nodes are always editable.
 */
export function isNodeTextEditable(): boolean {
  return true;
}

/**
 * Updates the shape/kind of a topic.
 */
export function updateNodeKind(
  ast: MermaidMindmapAST,
  nodeId: string,
  kind: string
): void {
  const node = ast.nodes.get(nodeId);
  if (!node) return;
  node.shape = kind as MindmapShape;
}

/**
 * Batch updates the shape/kind of topics.
 */
export function updateNodesKind(
  ast: MermaidMindmapAST,
  nodeIds: Iterable<string>,
  kind: string
): void {
  for (const id of nodeIds) {
    updateNodeKind(ast, id, kind);
  }
}
