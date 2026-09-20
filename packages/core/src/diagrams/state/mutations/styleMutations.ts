/**
 * Style mutations for Mermaid State Diagrams
 */

import { MermaidStateAST } from '../types';

export function updateStateStyle(
  ast: MermaidStateAST,
  stateId: string,
  styles: Record<string, string>
): void {
  if (stateId === '[*]') return;
  const state = ast.states.get(stateId);
  if (state) {
    state.style = { ...(state.style || {}), ...styles };
  }
  const comp = ast.compositeStates.get(stateId);
  if (comp) {
    comp.style = { ...(comp.style || {}), ...styles };
  }
  const existingIndex = ast.styles.findIndex((s) => s.targetId === stateId);
  if (existingIndex >= 0) {
    ast.styles[existingIndex].styles = {
      ...ast.styles[existingIndex].styles,
      ...styles,
    };
  } else {
    ast.styles.push({ targetId: stateId, styles: { ...styles } });
  }
}

export function updateStatesStyle(
  ast: MermaidStateAST,
  stateIds: Iterable<string>,
  styles: Record<string, string>
): void {
  for (const id of stateIds) {
    updateStateStyle(ast, id, styles);
  }
}

export function clearStateStyle(ast: MermaidStateAST, stateId: string): void {
  const defaultStyle = getDefaultStateStyle(ast);
  const state = ast.states.get(stateId);
  if (state) {
    if (defaultStyle) {
      state.style = { ...defaultStyle };
    } else {
      delete state.style;
    }
  }
  const comp = ast.compositeStates.get(stateId);
  if (comp) {
    if (defaultStyle) {
      comp.style = { ...defaultStyle };
    } else {
      delete comp.style;
    }
  }
  ast.styles = ast.styles.filter((s) => s.targetId !== stateId);
}

export function clearStatesStyle(
  ast: MermaidStateAST,
  stateIds: Iterable<string>
): void {
  const idSet = new Set(stateIds);
  for (const id of idSet) {
    const state = ast.states.get(id);
    if (state) {
      delete state.style;
    }
    const comp = ast.compositeStates.get(id);
    if (comp) {
      delete comp.style;
    }
  }
  ast.styles = ast.styles.filter((s) => !idSet.has(s.targetId));
}

export function getStateStyle(
  ast: MermaidStateAST,
  stateId: string
): Record<string, string> | undefined {
  return ast.states.get(stateId)?.style || ast.compositeStates.get(stateId)?.style;
}

export function updateCompositeStateStyle(
  ast: MermaidStateAST,
  compId: string,
  styles: Record<string, string>
): void {
  const comp = ast.compositeStates.get(compId);
  if (comp) {
    comp.style = { ...(comp.style || {}), ...styles };
  }
  const existingIndex = ast.styles.findIndex((s) => s.targetId === compId);
  if (existingIndex >= 0) {
    ast.styles[existingIndex].styles = {
      ...ast.styles[existingIndex].styles,
      ...styles,
    };
  } else {
    ast.styles.push({ targetId: compId, styles: { ...styles } });
  }
}

export function clearCompositeStateStyle(
  ast: MermaidStateAST,
  compId: string
): void {
  const comp = ast.compositeStates.get(compId);
  if (comp) {
    delete comp.style;
  }
  ast.styles = ast.styles.filter((s) => s.targetId !== compId);
}

export function getCompositeStateStyle(
  ast: MermaidStateAST,
  compId: string
): Record<string, string> | undefined {
  return ast.compositeStates.get(compId)?.style;
}

export function getDefaultStateStyle(
  ast: MermaidStateAST
): Record<string, string> | undefined {
  const line = ast.rawLines.find(
    (r) => !r.compositeId && /^classDef\s+default\b/i.test(r.text.trim())
  );
  if (!line) return undefined;
  const match = line.text.trim().match(/^classDef\s+default\s+(.*)$/i);
  if (!match) return undefined;
  const pairs = match[1].split(/[,;]/);
  const styles: Record<string, string> = {};
  for (const pair of pairs) {
    const colonIdx = pair.indexOf(':');
    if (colonIdx > 0) {
      const k = pair.slice(0, colonIdx).trim();
      const v = pair.slice(colonIdx + 1).trim();
      if (k && v) styles[k] = v;
    }
  }
  return Object.keys(styles).length > 0 ? styles : undefined;
}

export function updateDefaultStateStyle(
  ast: MermaidStateAST,
  styles: Record<string, string> | null
): void {
  ast.rawLines = ast.rawLines.filter(
    (r) => r.compositeId || !/^classDef\s+default\b/i.test(r.text.trim())
  );
  if (!styles || Object.keys(styles).length === 0) return;
  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(styles)) {
    if (typeof v === 'string' && v.trim()) clean[k.trim()] = v.trim();
  }
  if (Object.keys(clean).length === 0) return;
  const stylePairs = Object.entries(clean)
    .map(([k, v]) => `${k}:${v}`)
    .join(',');
  ast.rawLines.unshift({ text: `classDef default ${stylePairs}` });

  // Apply to states that don't have explicit style overrides
  const explicitTargets = new Set(ast.styles.map((s) => s.targetId));
  for (const [id, state] of ast.states.entries()) {
    if (id !== '[*]' && !explicitTargets.has(id)) {
      state.style = { ...clean };
    }
  }
}

export function clearDefaultStateStyle(ast: MermaidStateAST): void {
  ast.rawLines = ast.rawLines.filter(
    (r) => r.compositeId || !/^classDef\s+default\b/i.test(r.text.trim())
  );
  const explicitTargets = new Set(ast.styles.map((s) => s.targetId));
  for (const [id, state] of ast.states.entries()) {
    if (!explicitTargets.has(id)) {
      delete state.style;
    }
  }
}
