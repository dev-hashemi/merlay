/**
 * State diagram parser helpers: AST state tracking, style statements, and reconciliation.
 */

import { StateToken } from './lexer';
import {
  MermaidStateAST,
  MermaidStateDef,
  MermaidStateType,
} from './types';
import { getDefaultStateStyle } from './mutations/styleMutations';

export function parseStyleString(str: string): Record<string, string> {
  const styleMap: Record<string, string> = {};
  const parts = str.split(/[,;]/);
  for (const part of parts) {
    const colonIdx = part.indexOf(':');
    if (colonIdx !== -1) {
      const k = part.substring(0, colonIdx).trim();
      const v = part.substring(colonIdx + 1).trim();
      if (k && v) styleMap[k] = v;
    }
  }
  return styleMap;
}

export function parseAndApplyStyleStatement(
  lineTokens: StateToken[],
  ast: MermaidStateAST
): void {
  const colonIdx = lineTokens.findIndex((t) => t.type === 'COLON' || t.value.includes(':'));
  if (colonIdx <= 0) return;

  const splitIdx = lineTokens[colonIdx].type === 'COLON' ? colonIdx - 1 : colonIdx;
  const targetTokens = lineTokens.slice(0, splitIdx);
  const stylePropTokens = lineTokens.slice(splitIdx);
  const targets = targetTokens
    .map((t) => t.value)
    .join(' ')
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const styleString = stylePropTokens.map((t) => t.value).join('');
  const styleMap = parseStyleString(styleString);
  for (const targetId of targets) {
    ast.styles.push({ targetId, styles: styleMap });
    if (ast.states.has(targetId)) {
      ast.states.get(targetId)!.style = {
        ...(ast.states.get(targetId)!.style || {}),
        ...styleMap,
      };
    }
    if (ast.compositeStates.has(targetId)) {
      ast.compositeStates.get(targetId)!.style = {
        ...(ast.compositeStates.get(targetId)!.style || {}),
        ...styleMap,
      };
    }
  }
}

export function ensureStateInAst(
  ast: MermaidStateAST,
  compositeStack: string[],
  id: string,
  label?: string,
  stateType: MermaidStateType = 'normal',
  getOrder: () => number = () => 0
): void {
  const currentComp = compositeStack[compositeStack.length - 1];

  // Composite states are valid transition endpoints — never shadow them
  // with a duplicate state of the same id.
  if (id !== '[*]' && ast.compositeStates.has(id)) {
    return;
  }

  // [*] is an anchor pseudo-state — it is global and never belongs to a composite's stateIds
  if (id === '[*]') {
    if (!ast.states.has('[*]')) {
      ast.states.set('[*]', {
        type: 'state',
        id: '[*]',
        label: '[*]',
        stateType,
        order: getOrder(),
      });
    }
    return;
  }

  if (!ast.states.has(id)) {
    const newState: MermaidStateDef = {
      type: 'state',
      id,
      label: label || id,
      stateType,
      compositeId: currentComp,
      order: getOrder(),
    };
    ast.states.set(id, newState);

    if (currentComp && ast.compositeStates.has(currentComp)) {
      const comp = ast.compositeStates.get(currentComp)!;
      if (!comp.stateIds.includes(id)) {
        comp.stateIds.push(id);
      }
    }
  } else {
    const existing = ast.states.get(id)!;
    if (label) existing.label = label;
    if (stateType !== 'normal') existing.stateType = stateType;
    if (existing.order === undefined) existing.order = getOrder();
    if (currentComp && !existing.compositeId) {
      existing.compositeId = currentComp;
      const comp = ast.compositeStates.get(currentComp);
      if (comp && !comp.stateIds.includes(id)) {
        comp.stateIds.push(id);
      }
    }
  }
}

export function reconcileCompositesAndStyles(ast: MermaidStateAST): void {
  // 1. Reconcile implicit states created from forward transitions to composites
  for (const compId of ast.compositeStates.keys()) {
    const dupState = ast.states.get(compId);
    if (!dupState) continue;
    const comp = ast.compositeStates.get(compId)!;
    if (dupState.label && dupState.label !== compId && (comp.label === compId || !comp.label)) {
      comp.label = dupState.label;
    }
    ast.states.delete(compId);
    for (const other of ast.compositeStates.values()) {
      other.stateIds = other.stateIds.filter((id) => id !== compId);
    }
  }

  // 2. Reconcile styles onto states and composites (handles default theme and forward style declarations)
  const defaultStyle = getDefaultStateStyle(ast);
  if (defaultStyle) {
    for (const st of ast.states.values()) {
      if (!st.style || Object.keys(st.style).length === 0) {
        st.style = { ...defaultStyle };
      }
    }
    for (const comp of ast.compositeStates.values()) {
      if (!comp.style || Object.keys(comp.style).length === 0) {
        comp.style = { ...defaultStyle };
      }
    }
  }

  for (const s of ast.styles) {
    if (ast.states.has(s.targetId)) {
      ast.states.get(s.targetId)!.style = {
        ...(ast.states.get(s.targetId)!.style || {}),
        ...s.styles,
      };
    }
    if (ast.compositeStates.has(s.targetId)) {
      ast.compositeStates.get(s.targetId)!.style = {
        ...(ast.compositeStates.get(s.targetId)!.style || {}),
        ...s.styles,
      };
    }
  }
}
