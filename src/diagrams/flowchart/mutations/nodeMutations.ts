/**
 * Node-specific AST mutations for Flowchart diagrams
 */

import {
  FlowchartDirection,
  MermaidEdgeDef,
  MermaidFlowchartAST,
  MermaidNodeDef,
  MermaidShapeType,
} from '../types';
import { generateUniqueId } from '../../common/diagramHeader';

export function generateUniqueNodeId(
  ast: MermaidFlowchartAST,
  base = 'node'
): string {
  return generateUniqueId(new Set(ast.nodes.keys()), base);
}

export function addNode(
  ast: MermaidFlowchartAST,
  label: string = 'New Step',
  shape: MermaidShapeType = 'rectangle'
): string {
  const id = generateUniqueNodeId(ast, 'step');
  const newNode: MermaidNodeDef = {
    type: 'node',
    id,
    label: label.trim() || id,
    shape,
  };
  ast.nodes.set(id, newNode);
  return id;
}

export function addChildNode(
  ast: MermaidFlowchartAST,
  parentId: string,
  label: string = 'Next Step',
  shape: MermaidShapeType = 'rectangle'
): { nodeId: string; edgeId: string } {
  const childId = generateUniqueNodeId(ast, 'step');
  const parentNode = ast.nodes.get(parentId);

  const childNode: MermaidNodeDef = {
    type: 'node',
    id: childId,
    label: label.trim() || childId,
    shape,
    subgraphId: parentNode?.subgraphId,
  };
  ast.nodes.set(childId, childNode);

  if (childNode.subgraphId && ast.subgraphs.has(childNode.subgraphId)) {
    const sub = ast.subgraphs.get(childNode.subgraphId)!;
    if (!sub.nodeIds.includes(childId)) {
      sub.nodeIds.push(childId);
    }
  }

  const edgeId = `e_${parentId}_${childId}_${Date.now()}`;
  const newEdge: MermaidEdgeDef = {
    type: 'edge',
    id: edgeId,
    from: parentId,
    to: childId,
    arrowType: 'arrow',
  };
  ast.edges.push(newEdge);

  return { nodeId: childId, edgeId };
}

export function deleteNode(ast: MermaidFlowchartAST, nodeId: string): boolean {
  if (!ast.nodes.has(nodeId)) return false;

  // Remove node
  ast.nodes.delete(nodeId);

  // Remove connected edges
  ast.edges = ast.edges.filter((e) => e.from !== nodeId && e.to !== nodeId);

  // Remove from subgraphs
  for (const sub of ast.subgraphs.values()) {
    sub.nodeIds = sub.nodeIds.filter((id) => id !== nodeId);
  }

  // Remove from styles
  ast.styles = ast.styles.filter((s) => s.targetId !== nodeId);

  return true;
}

/**
 * Batch delete multiple nodes and all connected edges, subgraphs, and styles.
 */
export function deleteNodes(
  ast: MermaidFlowchartAST,
  nodeIds: Iterable<string>
): number {
  const idsSet = new Set(nodeIds);
  let deletedCount = 0;

  for (const id of idsSet) {
    if (ast.nodes.delete(id)) {
      deletedCount++;
    }
  }
  if (deletedCount === 0) return 0;

  // Filter edges connecting to any deleted node
  ast.edges = ast.edges.filter(
    (e) => !idsSet.has(e.from) && !idsSet.has(e.to)
  );

  // Filter from subgraphs
  for (const sub of ast.subgraphs.values()) {
    sub.nodeIds = sub.nodeIds.filter((id) => !idsSet.has(id));
  }

  // Filter styles
  ast.styles = ast.styles.filter((s) => !idsSet.has(s.targetId));

  return deletedCount;
}

export function updateNodeLabel(
  ast: MermaidFlowchartAST,
  nodeId: string,
  newLabel: string
): boolean {
  const node = ast.nodes.get(nodeId);
  if (!node) return false;
  node.label = newLabel.trim() || nodeId;
  return true;
}

export function updateNodeShape(
  ast: MermaidFlowchartAST,
  nodeId: string,
  newShape: MermaidShapeType
): boolean {
  const node = ast.nodes.get(nodeId);
  if (!node) return false;
  node.shape = newShape;
  return true;
}

/**
 * Batch update shape for multiple nodes.
 */
export function updateNodesShape(
  ast: MermaidFlowchartAST,
  nodeIds: Iterable<string>,
  shape: MermaidShapeType
): number {
  let count = 0;
  for (const id of nodeIds) {
    const node = ast.nodes.get(id);
    if (node) {
      node.shape = shape;
      count++;
    }
  }
  return count;
}

export function setDiagramDirection(
  ast: MermaidFlowchartAST,
  direction: FlowchartDirection
): void {
  ast.direction = direction;
}
