/**
 * Edge-specific AST mutations for Flowchart diagrams
 */

import {
  ArrowType,
  MermaidEdgeDef,
  MermaidFlowchartAST,
  MermaidNodeDef,
  MermaidShapeType,
} from '../types';
import { generateUniqueNodeId } from './nodeMutations';

export function connectNodes(
  ast: MermaidFlowchartAST,
  fromId: string,
  toId: string,
  arrowType: ArrowType = 'arrow',
  label?: string
): string | null {
  if (fromId === toId) return null;
  if (!ast.nodes.has(fromId) || !ast.nodes.has(toId)) return null;

  const edgeId = `e_${fromId}_${toId}_${Date.now()}_${ast.edges.length}`;
  const newEdge: MermaidEdgeDef = {
    type: 'edge',
    id: edgeId,
    from: fromId,
    to: toId,
    arrowType,
    label: label?.trim() || undefined,
    style: ast.defaultLinkStyle ? { ...ast.defaultLinkStyle } : undefined,
  };
  ast.edges.push(newEdge);
  return edgeId;
}

export function deleteEdge(ast: MermaidFlowchartAST, edgeId: string): boolean {
  const initialLen = ast.edges.length;
  ast.edges = ast.edges.filter((e) => e.id !== edgeId);
  return ast.edges.length < initialLen;
}

/**
 * Batch delete multiple edges from the diagram.
 */
export function deleteEdges(
  ast: MermaidFlowchartAST,
  edgeIds: Iterable<string>
): number {
  const idsSet = new Set(edgeIds);
  const initialLen = ast.edges.length;
  ast.edges = ast.edges.filter((e) => !idsSet.has(e.id));
  return initialLen - ast.edges.length;
}

export function updateEdgeLabel(
  ast: MermaidFlowchartAST,
  edgeId: string,
  newLabel: string
): boolean {
  const edge = ast.edges.find((e) => e.id === edgeId);
  if (!edge) return false;
  edge.label = newLabel.trim() || undefined;
  return true;
}

export function updateEdgeType(
  ast: MermaidFlowchartAST,
  edgeId: string,
  newType: ArrowType
): boolean {
  const edge = ast.edges.find((e) => e.id === edgeId);
  if (!edge) return false;
  edge.arrowType = newType;
  return true;
}

/**
 * Batch update arrow type for multiple edges.
 */
export function updateEdgesType(
  ast: MermaidFlowchartAST,
  edgeIds: Iterable<string>,
  arrowType: ArrowType
): number {
  let count = 0;
  for (const id of edgeIds) {
    if (updateEdgeType(ast, id, arrowType)) {
      count++;
    }
  }
  return count;
}

export function reverseEdgeDirection(
  ast: MermaidFlowchartAST,
  edgeId: string
): string | null {
  const edge = ast.edges.find((e) => e.id === edgeId);
  if (!edge) return null;

  const temp = edge.from;
  edge.from = edge.to;
  edge.to = temp;
  edge.id = `e_${edge.from}_${edge.to}_${Date.now()}`;
  return edge.id;
}

export function insertNodeOnEdge(
  ast: MermaidFlowchartAST,
  edgeId: string,
  label = 'New Step',
  shape: MermaidShapeType = 'rectangle'
): { nodeId: string; edge1Id: string; edge2Id: string } | null {
  const edgeIndex = ast.edges.findIndex((e) => e.id === edgeId);
  if (edgeIndex === -1) return null;

  const oldEdge = ast.edges[edgeIndex];
  const fromId = oldEdge.from;
  const toId = oldEdge.to;
  const arrowType = oldEdge.arrowType;
  const edgeLabel = oldEdge.label;

  const parentNode = ast.nodes.get(fromId);
  const childNode = ast.nodes.get(toId);
  const subgraphId = parentNode?.subgraphId || childNode?.subgraphId;

  const defaultClass = ast.classDefs.get('default');
  const newNodeId = generateUniqueNodeId(ast, 'step');
  const newNode: MermaidNodeDef = {
    type: 'node',
    id: newNodeId,
    label: label.trim() || newNodeId,
    shape,
    subgraphId,
    style: defaultClass?.styles ? { ...defaultClass.styles } : undefined,
  };
  ast.nodes.set(newNodeId, newNode);

  if (subgraphId && ast.subgraphs.has(subgraphId)) {
    const sub = ast.subgraphs.get(subgraphId)!;
    if (!sub.nodeIds.includes(newNodeId)) {
      sub.nodeIds.push(newNodeId);
    }
  }

  // Remove the old edge
  ast.edges.splice(edgeIndex, 1);

  // Add edge 1: fromId -> newNodeId (inheriting label)
  const edge1Id = `e_${fromId}_${newNodeId}_${Date.now()}`;
  const edge1: MermaidEdgeDef = {
    type: 'edge',
    id: edge1Id,
    from: fromId,
    to: newNodeId,
    arrowType,
    label: edgeLabel,
    style: ast.defaultLinkStyle ? { ...ast.defaultLinkStyle } : undefined,
  };

  // Add edge 2: newNodeId -> toId
  const edge2Id = `e_${newNodeId}_${toId}_${Date.now() + 1}`;
  const edge2: MermaidEdgeDef = {
    type: 'edge',
    id: edge2Id,
    from: newNodeId,
    to: toId,
    arrowType,
    style: ast.defaultLinkStyle ? { ...ast.defaultLinkStyle } : undefined,
  };

  ast.edges.push(edge1, edge2);

  return { nodeId: newNodeId, edge1Id, edge2Id };
}

export function insertNodeBetween(
  ast: MermaidFlowchartAST,
  fromId: string,
  toId: string,
  label = 'New Step',
  shape: MermaidShapeType = 'rectangle'
): { nodeId: string; edge1Id: string; edge2Id: string } | null {
  if (fromId === toId) return null;
  if (!ast.nodes.has(fromId) || !ast.nodes.has(toId)) return null;

  const existing = ast.edges.find((e) => e.from === fromId && e.to === toId);
  if (existing) {
    return insertNodeOnEdge(ast, existing.id, label, shape);
  }

  // If not directly connected yet, create node and connect both
  const parentNode = ast.nodes.get(fromId);
  const childNode = ast.nodes.get(toId);
  const subgraphId = parentNode?.subgraphId || childNode?.subgraphId;

  const defaultClass = ast.classDefs.get('default');
  const newNodeId = generateUniqueNodeId(ast, 'step');
  const newNode: MermaidNodeDef = {
    type: 'node',
    id: newNodeId,
    label: label.trim() || newNodeId,
    shape,
    subgraphId,
    style: defaultClass?.styles ? { ...defaultClass.styles } : undefined,
  };
  ast.nodes.set(newNodeId, newNode);

  if (subgraphId && ast.subgraphs.has(subgraphId)) {
    const sub = ast.subgraphs.get(subgraphId)!;
    if (!sub.nodeIds.includes(newNodeId)) {
      sub.nodeIds.push(newNodeId);
    }
  }

  const edge1Id = `e_${fromId}_${newNodeId}_${Date.now()}`;
  const edge1: MermaidEdgeDef = {
    type: 'edge',
    id: edge1Id,
    from: fromId,
    to: newNodeId,
    arrowType: 'arrow',
    style: ast.defaultLinkStyle ? { ...ast.defaultLinkStyle } : undefined,
  };

  const edge2Id = `e_${newNodeId}_${toId}_${Date.now() + 1}`;
  const edge2: MermaidEdgeDef = {
    type: 'edge',
    id: edge2Id,
    from: newNodeId,
    to: toId,
    arrowType: 'arrow',
    style: ast.defaultLinkStyle ? { ...ast.defaultLinkStyle } : undefined,
  };

  ast.edges.push(edge1, edge2);

  return { nodeId: newNodeId, edge1Id, edge2Id };
}
