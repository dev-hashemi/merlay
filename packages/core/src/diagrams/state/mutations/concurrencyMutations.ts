import { MermaidStateAST } from '../types';
import { generateStateId } from './stateMutations';

/**
 * Add a concurrency divider (--) to a composite state to split concurrent tracks.
 */
export function addConcurrencyDivider(
  ast: MermaidStateAST,
  compositeStateId: string
): boolean {
  const comp = ast.compositeStates.get(compositeStateId);
  if (!comp) return false;

  let maxOrder = comp.order ?? 0;

  // If composite has no states yet, add an initial state in track 1
  if (comp.stateIds.length === 0) {
    const s1Id = generateStateId('s', ast);
    ast.states.set(s1Id, {
      type: 'state',
      id: s1Id,
      label: s1Id,
      stateType: 'normal',
      compositeId: compositeStateId,
      order: ++maxOrder,
    });
    comp.stateIds.push(s1Id);
  }

  for (const sid of comp.stateIds) {
    const s = ast.states.get(sid);
    if (s && (s.order ?? 0) > maxOrder) {
      maxOrder = s.order!;
    }
  }

  for (const tr of ast.transitions) {
    const fromState = ast.states.get(tr.from);
    if (fromState?.compositeId === compositeStateId && (tr.order ?? 0) > maxOrder) {
      maxOrder = tr.order!;
    }
  }

  if (!ast.rawLines) {
    ast.rawLines = [];
  }

  for (const raw of ast.rawLines) {
    if (raw.compositeId === compositeStateId && (raw.order ?? 0) > maxOrder) {
      maxOrder = raw.order!;
    }
  }

  // 1. Add divider
  ast.rawLines.push({
    text: '--',
    compositeId: compositeStateId,
    order: maxOrder + 1,
  });

  // 2. Add an initial state for the new track so Mermaid never sees an empty track
  const s2Id = generateStateId('s', ast);
  ast.states.set(s2Id, {
    type: 'state',
    id: s2Id,
    label: s2Id,
    stateType: 'normal',
    compositeId: compositeStateId,
    order: maxOrder + 2,
  });
  comp.stateIds.push(s2Id);

  return true;
}

/**
 * Remove the last concurrency divider (--) from a composite state.
 */
export function removeConcurrencyDivider(
  ast: MermaidStateAST,
  compositeStateId: string
): boolean {
  if (!ast.rawLines) return false;

  for (let i = ast.rawLines.length - 1; i >= 0; i--) {
    const raw = ast.rawLines[i];
    if (raw.compositeId === compositeStateId && raw.text.trim() === '--') {
      ast.rawLines.splice(i, 1);
      return true;
    }
  }

  return false;
}

/**
 * Get the number of concurrency dividers (--) inside a composite state.
 */
export function getConcurrencyDividerCount(
  ast: MermaidStateAST,
  compositeStateId: string
): number {
  if (!ast.rawLines) return 0;
  return ast.rawLines.filter(
    (raw) => raw.compositeId === compositeStateId && raw.text.trim() === '--'
  ).length;
}
