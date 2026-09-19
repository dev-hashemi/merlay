/**
 * Sequence diagram driver: wires sequence parser, serializer, view projection,
 * and mutations into the unified DiagramDriver contract.
 */

import { DiagramDriver } from '../types';
import {
  ArrowType,
  MermaidEdgeDef,
  MermaidNodeDef,
  MermaidSubgraphDef,
} from '../viewModel';
import {
  MermaidSequenceAST,
  SequenceArrowType,
  SequenceBoxDef,
  SequenceMessageDef,
  SequenceParticipantDef,
  SequenceParticipantKind,
  SequenceTimelineItem,
} from './types';
import { parseMermaidSequenceDiagram } from './parser';
import { serializeMermaidSequenceDiagram } from './serializer';
import { findNodeLinkUrl } from '../nodeLinks';
import { matchesHeader } from '../common/diagramHeader';
import * as seq from './mutations';

const SEQUENCE_KIND_OPTIONS = [
  { kind: 'participant', label: 'Participant (Box)' },
  { kind: 'actor', label: 'Actor (Figure)' },
];

function sequenceArrowToViewModel(arrow: SequenceArrowType): ArrowType {
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

export const SequenceDiagramDriver: DiagramDriver<MermaidSequenceAST> = {
  type: 'sequenceDiagram',
  displayName: 'Sequence Diagram',
  supportsDirection: false,
  canHandle(code: string): boolean {
    return matchesHeader(code, /^sequenceDiagram\b/i);
  },
  parse(code: string): MermaidSequenceAST {
    return parseMermaidSequenceDiagram(code);
  },
  serialize(ast: MermaidSequenceAST): string {
    return serializeMermaidSequenceDiagram(ast);
  },
  createDefault(): string {
    return `sequenceDiagram\n    autonumber\n    actor Alice\n    participant Bob\n    Alice->>Bob: Hello Bob, how are you?\n    Bob-->>Alice: I am good thanks!\n`;
  },
  clone: cloneSequenceAst,
  createEmpty: createEmptySequenceAst,

  project(ast: MermaidSequenceAST) {
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
  },
  getNodeLink(ast: MermaidSequenceAST, nodeId: string): string | undefined {
    return findNodeLinkUrl(
      ast.rawLines.map((r) => r.text),
      nodeId
    );
  },

  capabilities: {
    supportsDirection: false,
    supportsNodeKinds: true,
    supportsEdgeTypes: true,
    supportsEdgeStyles: false,
    supportsGroups: true,
    hasAnchors: false,
  },

  labels: {
    node: 'Participant',
    nodes: 'Participants',
    edge: 'Message',
    edges: 'Messages',
    group: 'Box',
    addNode: 'Add Participant',
    addGroup: 'Add Box',
    addChild: 'Next Message',
    insertNodeOnEdge: 'Insert Participant',
    edgeLabelPlaceholder: 'Message (e.g. getData())...',
  },

  nodeKindOptions: SEQUENCE_KIND_OPTIONS,

  mutations: {
    addNode: (ast, label) => seq.addParticipant(ast, label),
    addChildNode: (ast, parentId, label) =>
      seq.addChildParticipant(ast, parentId, label),
    deleteNode: (ast, nodeId) => {
      seq.deleteParticipant(ast, nodeId);
    },
    deleteNodes: (ast, nodeIds) => {
      seq.deleteParticipants(ast, nodeIds);
    },
    updateNodeLabel: (ast, nodeId, label) => {
      seq.updateParticipantLabel(ast, nodeId, label);
    },
    isNodeTextEditable: (ast, nodeId) =>
      seq.isParticipantTextEditable(ast.participants.get(nodeId)),
    updateNodeKind: (ast, nodeId, kind) => {
      seq.updateParticipantKind(ast, nodeId, kind as SequenceParticipantKind);
    },
    updateNodesKind: (ast, nodeIds, kind) => {
      for (const id of nodeIds) {
        seq.updateParticipantKind(ast, id, kind as SequenceParticipantKind);
      }
    },

    connect: (ast, fromId, toId, context) => {
      seq.connectParticipants(
        ast,
        fromId,
        toId,
        'Message',
        'solid_arrow',
        context?.insertAfterEdgeId,
        context?.insertAtIndex
      );
    },
    // Messages between any participants (including across boxes) are legal.
    canConnect: () => true,
    deleteEdge: (ast, edgeId) => {
      seq.deleteMessage(ast, edgeId);
    },
    deleteEdges: (ast, edgeIds) => {
      seq.deleteMessages(ast, edgeIds);
    },
    updateEdgeLabel: (ast, edgeId, label) => {
      seq.updateMessageLabel(ast, edgeId, label);
    },
    reverseEdge: (ast, edgeId) => {
      return seq.reverseMessage(ast, edgeId);
    },
    insertNodeOnEdge: (ast, edgeId, label) => {
      return seq.insertParticipantOnMessage(ast, edgeId, label);
    },
    updateEdgeType: (ast, edgeId, type) => {
      seq.updateMessageType(ast, edgeId, type);
    },
    updateEdgesType: (ast, edgeIds, type) => {
      seq.updateMessagesType(ast, edgeIds, type);
    },

    getNodeStyle: (ast, nodeId) => seq.getParticipantStyle(ast, nodeId),
    updateNodeStyle: (ast, nodeId, styles) => {
      if (styles && Object.keys(styles).length > 0) {
        seq.updateParticipantStyle(ast, nodeId, styles);
      } else {
        seq.clearParticipantStyle(ast, nodeId);
      }
    },
    updateNodesStyle: (ast, nodeIds, styles) => {
      if (styles && Object.keys(styles).length > 0) {
        seq.updateParticipantsStyle(ast, nodeIds, styles);
      } else {
        seq.clearParticipantsStyle(ast, nodeIds);
      }
    },
    clearNodeStyle: (ast, nodeId) => {
      seq.clearParticipantStyle(ast, nodeId);
    },
    clearNodesStyle: (ast, nodeIds) => {
      seq.clearParticipantsStyle(ast, nodeIds);
    },

    getGroupStyle: (ast, groupId) => seq.getBoxStyle(ast, groupId),
    updateGroupStyle: (ast, groupId, styles) => {
      if (styles && Object.keys(styles).length > 0) {
        seq.updateBoxStyle(ast, groupId, styles);
      } else {
        seq.clearBoxStyle(ast, groupId);
      }
    },
    clearGroupStyle: (ast, groupId) => {
      seq.clearBoxStyle(ast, groupId);
    },
    createGroup: (ast, label) => {
      const boxId = seq.createBox(ast, label);
      seq.addParticipant(ast, 'Participant 1', 'participant', boxId);
      return boxId;
    },
    createGroupWithMembers: (ast, label, nodeIds) => {
      return seq.createBoxWithMembers(ast, label, nodeIds);
    },
    deleteGroup: (ast, groupId, deleteMembers) => {
      seq.deleteBox(ast, groupId, deleteMembers);
    },
    renameGroup: (ast, groupId, label) => {
      seq.renameBox(ast, groupId, label);
    },
    moveNodeToGroup: (ast, nodeId, groupId) => {
      seq.moveParticipantToBox(ast, nodeId, groupId);
    },
    moveNodesToGroup: (ast, nodeIds, groupId) => {
      seq.moveParticipantsToBox(ast, nodeIds, groupId);
    },

    duplicateNodes: (ast, nodeIds) => {
      const res = seq.duplicateParticipants(ast, nodeIds);
      return { nodeIds: res.participantIds, edgeIds: res.messageIds };
    },

    getDirection: () => undefined,
    setDirection: () => {
      /* no-op: sequence diagrams don't support direction */
    },
  },

  dom: {
    nodeIdPrefixes: ['actor', 'participant-'],
    nodeSelector: '.node, [class*="node "], .actor, [class*="actor"]',
    edgeSelector:
      '.edgePaths path, .edgePath path, path.flowchart-link, [class*="flowchart-link"], line.messageLine0, line.messageLine1, [class*="messageLine"], path.messageLine0, path.messageLine1',
  },
};
