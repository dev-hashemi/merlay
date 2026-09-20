/**
 * Sequence diagram driver: wires sequence parser, serializer, view projection,
 * and mutations into the unified DiagramDriver contract.
 */

import { DiagramDriver } from '../types';
import {
  MermaidSequenceAST,
  SequenceParticipantKind,
} from './types';
import { parseMermaidSequenceDiagram } from './parser';
import { serializeMermaidSequenceDiagram } from './serializer';
import { findNodeLinkUrl } from '../nodeLinks';
import { matchesHeader, getDiagramTheme, setDiagramTheme } from '../common/diagramHeader';
import {
  cloneSequenceAst,
  createEmptySequenceAst,
  projectSequenceAst,
} from './sequenceProjection';
import * as seq from './mutations';

export { cloneSequenceAst, createEmptySequenceAst, projectSequenceAst };

const SEQUENCE_KIND_OPTIONS = [
  { kind: 'participant', label: 'Participant (Box)' },
  { kind: 'actor', label: 'Actor (Figure)' },
];

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
  project: projectSequenceAst,
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

  canvasHint: {
    desktop:
      'Drag from a participant handle to connect • Click message to edit • Double-click to rename',
    touch:
      'Drag from a participant to connect • Tap message to edit • Double-tap to rename',
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
    getTheme: (ast) => getDiagramTheme(ast.frontmatter),
    setTheme: (ast, theme) => {
      ast.frontmatter = setDiagramTheme(ast.frontmatter, theme);
    },
  },

  dom: {
    nodeIdPrefixes: ['actor', 'participant-'],
    nodeSelector: '.node, [class*="node "], .actor, [class*="actor"]',
    edgeSelector:
      '.edgePaths path, .edgePath path, path.flowchart-link, [class*="flowchart-link"], line.messageLine0, line.messageLine1, [class*="messageLine"], path.messageLine0, path.messageLine1',
  },
};
