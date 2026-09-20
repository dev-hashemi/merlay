import {
  MermaidNodeDef,
  MermaidEdgeDef,
  MermaidSubgraphDef,
  MermaidShapeType,
} from '../viewModel';
import {
  MermaidStateAST,
  MermaidStateType,
} from './types';
import * as st from './mutations';

export const STATE_KIND_OPTIONS = [
  { kind: 'normal', label: 'Normal State' },
  { kind: 'choice', label: 'Choice <<choice>>' },
  { kind: 'fork', label: 'Fork <<fork>>' },
  { kind: 'join', label: 'Join <<join>>' },
];

/** Map a state type onto the shared flowchart-shaped view model. */
export function stateTypeToShape(stateType: MermaidStateType): MermaidShapeType {
  if (stateType === 'start' || stateType === 'end') return 'circle';
  if (stateType === 'choice') return 'diamond';
  return 'rectangle'; // normal, fork, join
}

export function cloneStateAst(ast: MermaidStateAST): MermaidStateAST {
  return {
    ...ast,
    frontmatter: ast.frontmatter,
    states: new Map(Array.from(ast.states, ([id, s]) => [id, { ...s }])),
    transitions: ast.transitions.map((t) => ({ ...t })),
    compositeStates: new Map(
      Array.from(ast.compositeStates, ([id, c]) => [
        id,
        {
          ...c,
          stateIds: [...c.stateIds],
          compositeIds: [...c.compositeIds],
        },
      ])
    ),
    styles: ast.styles.map((s) => ({ ...s })),
    rawLines: ast.rawLines.map((r) => ({ ...r })),
  };
}

export function createEmptyStateAst(): MermaidStateAST {
  return {
    diagramType: 'stateDiagram-v2',
    frontmatter: undefined,
    states: new Map(),
    transitions: [],
    compositeStates: new Map(),
    styles: [],
    rawLines: [],
  };
}

export function projectStateDiagram(ast: MermaidStateAST) {
  const nodes = new Map<string, MermaidNodeDef>();
  for (const [id, state] of ast.states.entries()) {
    if (id === '[*]') continue;
    nodes.set(id, {
      type: 'node',
      id,
      label: state.label || id,
      shape: stateTypeToShape(state.stateType),
      kind: state.stateType,
      subgraphId: state.compositeId,
      style: state.style,
    });
  }

  // Root start/end anchors
  if (st.hasStartState(ast) || st.hasEndState(ast)) {
    nodes.set('[*]', {
      type: 'node',
      id: '[*]',
      label: '[*]',
      shape: 'circle',
      kind: undefined,
      subgraphId: undefined,
    });
  }

  // Composite-scoped start/end anchors
  for (const compId of ast.compositeStates.keys()) {
    if (st.hasStartState(ast, compId) || st.hasEndState(ast, compId)) {
      nodes.set(`[*]:${compId}`, {
        type: 'node',
        id: `[*]:${compId}`,
        label: '[*]',
        shape: 'circle',
        kind: undefined,
        subgraphId: compId,
      });
    }
  }

  const edges: MermaidEdgeDef[] = ast.transitions.map((tr) => ({
    type: 'edge' as const,
    id: tr.id,
    from: tr.from,
    to: tr.to,
    arrowType: 'arrow' as const,
    label: tr.label,
    style: tr.style,
  }));

  const subgraphs = new Map<string, MermaidSubgraphDef>();
  for (const [id, comp] of ast.compositeStates.entries()) {
    const stateIds = [...comp.stateIds];
    if (st.hasStartState(ast, id) || st.hasEndState(ast, id)) {
      if (!stateIds.includes(`[*]:${id}`)) {
        stateIds.push(`[*]:${id}`);
      }
    }
    subgraphs.set(id, {
      type: 'subgraph',
      id,
      label: comp.label,
      direction: comp.direction || ast.direction || 'TD',
      nodeIds: stateIds,
      subgraphIds: comp.compositeIds,
      style: comp.style,
    });
  }
  return {
    nodes,
    edges,
    subgraphs,
    direction: ast.direction,
  };
}
