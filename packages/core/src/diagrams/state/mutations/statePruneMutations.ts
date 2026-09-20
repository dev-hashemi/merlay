/**
 * Cleanup, pruning, and anchor removal mutations for Mermaid State Diagrams
 */

import { MermaidStateAST } from '../types';

/** Remove composites left with no real members ([*] alone does not count). */
export function pruneEmptyComposites(ast: MermaidStateAST): void {
  let changed = true;
  while (changed) {
    changed = false;
    for (const [compId, comp] of Array.from(ast.compositeStates.entries())) {
      const hasNested = (comp.compositeIds?.length ?? 0) > 0;
      const hasMembers = comp.stateIds.some((id) => id !== '[*]');
      if (!hasNested && !hasMembers) {
        for (const sid of comp.stateIds) {
          const st = ast.states.get(sid);
          if (st && st.compositeId === compId) {
            delete st.compositeId;
          }
        }
        removeComposite(ast, compId);
        changed = true;
      }
    }
  }
}

/** Delete a composite definition along with its styles and the transitions
 * that referenced it as an endpoint. */
export function removeComposite(ast: MermaidStateAST, compId: string): void {
  ast.compositeStates.delete(compId);
  ast.styles = ast.styles.filter((s) => s.targetId !== compId);
  ast.transitions = ast.transitions.filter(
    (t) => t.from !== compId && t.to !== compId
  );
  for (const comp of ast.compositeStates.values()) {
    if (comp.compositeIds) {
      comp.compositeIds = comp.compositeIds.filter((id) => id !== compId);
    }
  }
}

/** Drop the [*] entry once no transition references it (it renders nothing). */
export function pruneOrphanStartEnd(ast: MermaidStateAST): void {
  if (
    ast.states.has('[*]') &&
    !ast.transitions.some((t) => t.from === '[*]' || t.to === '[*]')
  ) {
    ast.states.delete('[*]');
  }
}

export function deleteStartAnchor(ast: MermaidStateAST, compositeId?: string): void {
  const before = ast.transitions.length;
  if (compositeId) {
    const comp = ast.compositeStates.get(compositeId);
    if (!comp) return;
    const members = new Set([...comp.stateIds, ...(comp.compositeIds || [])]);
    ast.transitions = ast.transitions.filter(
      (t) => !(t.from === '[*]' && members.has(t.to))
    );
  } else {
    ast.transitions = ast.transitions.filter(
      (t) =>
        !(
          t.from === '[*]' &&
          (ast.compositeStates.has(t.to) || ast.states.get(t.to)?.compositeId === undefined)
        )
    );
  }
  if (ast.transitions.length !== before) {
    pruneOrphanStartEnd(ast);
  }
}

export function deleteEndAnchor(ast: MermaidStateAST, compositeId?: string): void {
  const before = ast.transitions.length;
  if (compositeId) {
    const comp = ast.compositeStates.get(compositeId);
    if (!comp) return;
    const members = new Set([...comp.stateIds, ...(comp.compositeIds || [])]);
    ast.transitions = ast.transitions.filter(
      (t) => !(t.to === '[*]' && members.has(t.from))
    );
  } else {
    ast.transitions = ast.transitions.filter(
      (t) =>
        !(
          t.to === '[*]' &&
          (ast.compositeStates.has(t.from) || ast.states.get(t.from)?.compositeId === undefined)
        )
    );
  }
  if (ast.transitions.length !== before) {
    pruneOrphanStartEnd(ast);
  }
}
