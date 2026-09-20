/**
 * Duplication and Clipboard AST mutations for Flowchart diagrams
 */

import { MermaidEdgeDef, MermaidFlowchartAST, MermaidNodeDef } from '../types';
import { generateUniqueNodeId } from './nodeMutations';

/**
 * Duplicate nodes with unique IDs, cloning styles and internal edges.
 */
export function duplicateNodes(
  ast: MermaidFlowchartAST,
  nodeIds: Iterable<string>
): { nodeIds: string[]; edgeIds: string[] } {
  const originalIds = Array.from(nodeIds).filter((id) => ast.nodes.has(id));
  if (originalIds.length === 0) return { nodeIds: [], edgeIds: [] };

  const idMap = new Map<string, string>();
  const newCreatedNodeIds: string[] = [];

  for (const oldId of originalIds) {
    const oldNode = ast.nodes.get(oldId)!;
    const newId = generateUniqueNodeId(ast, oldId.replace(/_\d+$/, ''));
    idMap.set(oldId, newId);

    const clonedNode: MermaidNodeDef = {
      type: 'node',
      id: newId,
      label: `${oldNode.label} (copy)`,
      shape: oldNode.shape,
      subgraphId: oldNode.subgraphId,
      style: oldNode.style ? { ...oldNode.style } : undefined,
      classes: oldNode.classes ? [...oldNode.classes] : undefined,
    };

    ast.nodes.set(newId, clonedNode);
    newCreatedNodeIds.push(newId);

    if (clonedNode.subgraphId && ast.subgraphs.has(clonedNode.subgraphId)) {
      ast.subgraphs.get(clonedNode.subgraphId)!.nodeIds.push(newId);
    }
  }

  // Duplicate internal edges connecting the duplicated nodes
  const newCreatedEdgeIds: string[] = [];
  const originalSet = new Set(originalIds);
  for (const edge of ast.edges) {
    if (originalSet.has(edge.from) && originalSet.has(edge.to)) {
      const newFrom = idMap.get(edge.from)!;
      const newTo = idMap.get(edge.to)!;
      const newEdgeId = `e_${newFrom}_${newTo}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const newEdge: MermaidEdgeDef = {
        type: 'edge',
        id: newEdgeId,
        from: newFrom,
        to: newTo,
        arrowType: edge.arrowType,
        label: edge.label,
        style: edge.style ? { ...edge.style } : undefined,
      };
      ast.edges.push(newEdge);
      newCreatedEdgeIds.push(newEdgeId);
    }
  }

  return { nodeIds: newCreatedNodeIds, edgeIds: newCreatedEdgeIds };
}
