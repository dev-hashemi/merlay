/**
 * Deletion and pruning mutations for Flowchart subgraphs
 */

import { MermaidFlowchartAST } from '../types';
import { deleteNodes } from './nodeMutations';

/**
 * Delete a subgraph.
 * If deleteInnerNodes is false (default), the subgraph is dissolved (nodes become ungrouped).
 * If deleteInnerNodes is true, all inner nodes and their edges are deleted.
 */
export function deleteSubgraph(
  ast: MermaidFlowchartAST,
  subgraphId: string,
  deleteInnerNodes: boolean = false
): boolean {
  if (!ast.subgraphs.has(subgraphId)) return false;

  const sub = ast.subgraphs.get(subgraphId)!;
  const innerNodeIds = [...sub.nodeIds];

  if (deleteInnerNodes) {
    deleteNodes(ast, innerNodeIds);
  } else {
    for (const nid of innerNodeIds) {
      const node = ast.nodes.get(nid);
      if (node && node.subgraphId === subgraphId) {
        delete node.subgraphId;
      }
    }
  }

  // Remove from parent subgraphs if nested
  for (const parentSub of ast.subgraphs.values()) {
    parentSub.subgraphIds = parentSub.subgraphIds.filter((id) => id !== subgraphId);
  }

  // Remove style if any
  ast.styles = ast.styles.filter((s) => s.targetId !== subgraphId);

  // Remove subgraph definition
  ast.subgraphs.delete(subgraphId);
  return true;
}

/**
 * Dissolve a group left completely empty (no nodes, no subgroups).
 * Used after member moves so "get me out" style actions never leave
 * hollow shells behind. Pre-existing empty groups are never passed here,
 * only groups that just lost a member. Returns true when dissolved.
 */
export function pruneEmptySubgraph(
  ast: MermaidFlowchartAST,
  subId: string | null | undefined
): boolean {
  if (!subId) return false;
  const sub = ast.subgraphs.get(subId);
  if (!sub) return false;
  if (sub.nodeIds.length > 0 || (sub.subgraphIds ?? []).length > 0) return false;
  return deleteSubgraph(ast, subId, false);
}
