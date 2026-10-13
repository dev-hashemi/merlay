/**
 * Deletion and pruning mutations for Flowchart subgraphs
 */

import { MermaidFlowchartAST } from '../types';
import { deleteNodes } from './nodeMutations';

export function findParentSubgraphId(
  ast: MermaidFlowchartAST,
  childId: string
): string | null {
  for (const [id, sub] of ast.subgraphs.entries()) {
    if (sub.subgraphIds?.includes(childId)) return id;
  }
  return null;
}

/**
 * Delete a subgraph.
 * If deleteInnerNodes is false (default), the subgraph is dissolved (nodes become ungrouped or reparented to parent).
 * If deleteInnerNodes is true, all inner nodes, nested subgraphs, and their edges are deleted recursively.
 */
export function deleteSubgraph(
  ast: MermaidFlowchartAST,
  subgraphId: string,
  deleteInnerNodes: boolean = false
): boolean {
  if (!ast.subgraphs.has(subgraphId)) return false;

  const sub = ast.subgraphs.get(subgraphId)!;
  const parentSubId = findParentSubgraphId(ast, subgraphId);
  const parentSub = parentSubId ? ast.subgraphs.get(parentSubId) : undefined;

  if (deleteInnerNodes) {
    // Recursively delete all nested child subgraphs
    const childSubs = [...(sub.subgraphIds || [])];
    for (const childId of childSubs) {
      deleteSubgraph(ast, childId, true);
    }
    // Delete inner nodes
    deleteNodes(ast, [...sub.nodeIds]);
  } else {
    // Dissolve: reparent inner nodes to parent subgraph or to root
    for (const nid of sub.nodeIds) {
      const node = ast.nodes.get(nid);
      if (node && node.subgraphId === subgraphId) {
        if (parentSub) {
          node.subgraphId = parentSub.id;
          if (!parentSub.nodeIds.includes(nid)) {
            parentSub.nodeIds.push(nid);
          }
        } else {
          delete node.subgraphId;
        }
      }
    }
    // Reparent nested child subgraphs to parent subgraph if nested
    if (sub.subgraphIds && parentSub) {
      for (const childId of sub.subgraphIds) {
        if (!parentSub.subgraphIds.includes(childId)) {
          parentSub.subgraphIds.push(childId);
        }
      }
    }
  }

  // Remove from parent subgraphs if nested
  for (const p of ast.subgraphs.values()) {
    p.subgraphIds = p.subgraphIds.filter((id) => id !== subgraphId);
  }

  // Remove style if any
  ast.styles = ast.styles.filter((s) => s.targetId !== subgraphId);

  // Remove any edges connecting directly to or from this subgraph
  ast.edges = ast.edges.filter((e) => e.from !== subgraphId && e.to !== subgraphId);

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
