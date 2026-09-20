/**
 * Duplication and Clipboard mutations for Mermaid State Diagrams
 */

import { MermaidStateAST, MermaidStateDef } from '../types';
import { connectStates } from './transitionMutations';
import { generateStateId } from './stateMutations';

export function duplicateStates(
  ast: MermaidStateAST,
  stateIds: Iterable<string>
): { stateIds: string[]; transitionIds: string[] } {
  const idMap = new Map<string, string>();
  const newCreatedStateIds: string[] = [];
  const newCreatedTransitionIds: string[] = [];

  for (const sid of stateIds) {
    if (sid === '[*]') continue;
    const oldState = ast.states.get(sid);
    if (!oldState) continue;

    const baseName = oldState.label || sid;
    const newId = generateStateId('s', ast);
    idMap.set(sid, newId);
    newCreatedStateIds.push(newId);

    const isPseudo =
      oldState.stateType === 'choice' ||
      oldState.stateType === 'fork' ||
      oldState.stateType === 'join';

    const clonedState: MermaidStateDef = {
      type: 'state',
      id: newId,
      label: isPseudo ? newId : `${baseName} Copy`,
      stateType: oldState.stateType,
      compositeId: oldState.compositeId,
      style: oldState.style ? { ...oldState.style } : undefined,
    };
    ast.states.set(newId, clonedState);

    if (clonedState.style) {
      ast.styles.push({ targetId: newId, styles: { ...clonedState.style } });
    }

    if (oldState.compositeId && ast.compositeStates.has(oldState.compositeId)) {
      ast.compositeStates.get(oldState.compositeId)!.stateIds.push(newId);
    }
  }

  for (const tr of ast.transitions) {
    const newFrom = idMap.get(tr.from);
    const newTo = idMap.get(tr.to);
    if (newFrom && newTo) {
      const newTr = connectStates(ast, newFrom, newTo, tr.label);
      if (newTr) newCreatedTransitionIds.push(newTr.id);
    }
  }

  return { stateIds: newCreatedStateIds, transitionIds: newCreatedTransitionIds };
}
