/**
 * Sequence diagram AST cloning, creation, and view-model projection.
 */

import {
  ArrowType,
  MermaidEdgeDef,
  MermaidNodeDef,
  MermaidSubgraphDef,
} from '../viewModel';
import { ViewProjection } from '../types';
import {
  MermaidSequenceAST,
  SequenceArrowType,
  SequenceBoxDef,
  SequenceMessageDef,
  SequenceParticipantDef,
  SequenceTimelineItem,
} from './types';

export function sequenceArrowToViewModel(arrow: SequenceArrowType): ArrowType {
  switch (arrow) {
    case 'dotted_arrow':
      return 'dotted';
    case 'solid_open':
      return 'open';
    case 'dotted_open':
      return 'dotted_open';
    case 'solid_cross':
    case 'dotted_cross':
      return 'cross';
    case 'solid_async':
      return 'arrow';
    case 'dotted_async':
      return 'dotted';
    case 'solid_arrow':
    default:
      return 'arrow';
  }
}

export function cloneSequenceAst(ast: MermaidSequenceAST): MermaidSequenceAST {
  const participants = new Map<string, SequenceParticipantDef>();
  for (const [id, p] of ast.participants.entries()) {
    participants.set(id, {
      ...p,
      style: p.style ? { ...p.style } : undefined,
    });
  }

  const boxes = new Map<string, SequenceBoxDef>();
  for (const [id, b] of ast.boxes.entries()) {
    boxes.set(id, { ...b, participantIds: [...b.participantIds] });
  }

  const messages = ast.messages.map((m) => ({ ...m }));
  const messageMap = new Map<string, SequenceMessageDef>();
  for (const m of messages) {
    messageMap.set(m.id, m);
  }

  const timeline: SequenceTimelineItem[] = ast.timeline.map((item) => {
    if (item.type === 'message') {
      const clonedMsg = messageMap.get(item.message.id) || { ...item.message };
      return { type: 'message', message: clonedMsg };
    }
    return { ...item };
  });

  return {
    diagramType: ast.diagramType,
    frontmatter: ast.frontmatter,
    autonumber: ast.autonumber,
    directives: [...ast.directives],
    participants,
    messages,
    boxes,
    timeline,
    rawLines: ast.rawLines ? ast.rawLines.map((r) => ({ ...r })) : [],
  };
}

export function createEmptySequenceAst(): MermaidSequenceAST {
  return {
    diagramType: 'sequenceDiagram',
    frontmatter: undefined,
    autonumber: false,
    directives: [],
    participants: new Map(),
    messages: [],
    boxes: new Map(),
    timeline: [],
    rawLines: [],
  };
}

export function projectSequenceAst(ast: MermaidSequenceAST): ViewProjection {
  const nodes = new Map<string, MermaidNodeDef>();
  for (const [id, p] of ast.participants.entries()) {
    nodes.set(id, {
      type: 'node',
      id,
      label: p.label || id,
      shape: p.kind === 'actor' ? 'circle' : 'rectangle',
      kind: p.kind,
      subgraphId: p.boxId,
      style: p.style,
    });
  }

  const edges: MermaidEdgeDef[] = ast.messages.map((m) => ({
    type: 'edge',
    id: m.id,
    from: m.from,
    to: m.to,
    arrowType: sequenceArrowToViewModel(m.arrow),
    label: m.label,
  }));

  const subgraphs = new Map<string, MermaidSubgraphDef>();
  for (const [id, b] of ast.boxes.entries()) {
    subgraphs.set(id, {
      type: 'subgraph',
      id,
      label: b.label,
      nodeIds: [...b.participantIds],
      subgraphIds: [],
      style: b.color ? { color: b.color } : undefined,
    });
  }

  return {
    nodes,
    edges,
    subgraphs,
    direction: undefined,
  };
}
