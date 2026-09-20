import { MermaidStateAST } from '../types';
import { addState } from './stateMutations';
import {
  findParentComposite,
  createCompositeState,
  moveStateToComposite,
  deleteCompositeState,
} from './compositeMutations';

/**
 * Group existing nodes/composites into a new composite state,
 * properly handling reparenting, drained ancestors, and transition rebinding.
 */
export function createCompositeWithMembers(
  ast: MermaidStateAST,
  label: string,
  nodeIds: Iterable<string>
): string {
  const memberIds = Array.from(nodeIds);

  let sharedParent: string | null = null;
  let hasMembers = false;
  let mixedParents = false;
  const drainedParents = new Set<string>();
  for (const nid of memberIds) {
    let parent: string | null;
    if (ast.compositeStates.has(nid)) {
      parent = findParentComposite(ast, nid);
    } else if (ast.states.has(nid)) {
      if (nid === '[*]' || nid.startsWith('[*]:')) continue;
      parent = ast.states.get(nid)!.compositeId ?? null;
    } else {
      continue;
    }
    if (parent) drainedParents.add(parent);
    if (mixedParents) continue;
    if (!hasMembers) {
      sharedParent = parent;
      hasMembers = true;
    } else if (sharedParent !== parent) {
      mixedParents = true;
    }
  }
  const nestParent = !mixedParents && hasMembers ? sharedParent : null;

  const compId = createCompositeState(ast, label);
  {
    const memberSet = new Set(memberIds);
    const consumed: string[] = [];
    for (const pid of drainedParents) {
      const pdef = ast.compositeStates.get(pid);
      if (!pdef) continue;
      const content = [...pdef.stateIds, ...(pdef.compositeIds ?? [])];
      if (content.length > 0 && content.every((id) => memberSet.has(id))) {
        consumed.push(pid);
      }
    }
    if (consumed.length > 0) {
      const consumedSet = new Set(consumed);
      for (const tr of ast.transitions) {
        if (consumedSet.has(tr.from)) tr.from = compId;
        if (consumedSet.has(tr.to)) tr.to = compId;
      }
    }
  }
  for (const nid of memberIds) {
    moveStateToComposite(ast, nid, compId);
  }
  const comp = ast.compositeStates.get(compId);
  if (comp && comp.stateIds.length === 0 && (!comp.compositeIds || comp.compositeIds.length === 0)) {
    addState(ast, 'State 1', 'normal', compId);
  }

  if (nestParent) {
    moveStateToComposite(ast, compId, nestParent);
    const parentDef = ast.compositeStates.get(nestParent);
    const nestedOk = parentDef?.compositeIds?.includes(compId) ?? false;
    const parentEmptied =
      nestedOk &&
      (parentDef!.stateIds.length === 0) &&
      (parentDef!.compositeIds ?? []).filter((id) => id !== compId).length === 0 &&
      !memberIds.some((id) => ast.compositeStates.has(id));
    if (parentEmptied) {
      for (const tr of ast.transitions) {
        if (tr.from === nestParent) tr.from = compId;
        if (tr.to === nestParent) tr.to = compId;
      }
      const grandparent = findParentComposite(ast, nestParent);
      moveStateToComposite(ast, compId, grandparent ?? undefined);
      deleteCompositeState(ast, nestParent, false);
    }
  }

  const drainQueue = [...drainedParents];
  while (drainQueue.length > 0) {
    const drainedId = drainQueue.pop()!;
    if (drainedId === nestParent) continue;
    const drainedDef = ast.compositeStates.get(drainedId);
    if (
      !drainedDef ||
      drainedDef.stateIds.length > 0 ||
      (drainedDef.compositeIds ?? []).length > 0
    ) {
      continue;
    }
    for (const tr of ast.transitions) {
      if (tr.from === drainedId) tr.from = compId;
      if (tr.to === drainedId) tr.to = compId;
    }
    const grandparent = findParentComposite(ast, drainedId);
    deleteCompositeState(ast, drainedId, false);
    if (grandparent && grandparent !== drainedId) drainQueue.push(grandparent);
  }
  return compId;
}
