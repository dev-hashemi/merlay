/**
 * State diagram driver: wires the state parser/serializer and mutations into
 * the unified DiagramDriver contract.
 */

import { DiagramDriver } from '../types';
import { stateDomAdapter } from './domAdapter';
import { MermaidStateAST, MermaidStateType, StateDirection } from './types';
import { parseMermaidStateDiagram } from './parser';
import { serializeMermaidStateDiagram } from './serializer';
import { findNodeLinkUrl } from '../nodeLinks';
import { matchesHeader, getDiagramTheme, setDiagramTheme } from '../common/diagramHeader';
import * as st from './mutations';

import {
  cloneStateAst,
  createEmptyStateAst,
  projectStateDiagram,
  STATE_KIND_OPTIONS,
} from './projection';

export const StateDiagramDriver: DiagramDriver<MermaidStateAST> = {
  type: 'stateDiagram',
  displayName: 'State Diagram',
  supportsDirection: true,
  canHandle(code: string): boolean {
    return matchesHeader(code, /^stateDiagram(-v2)?\b/i);
  },
  parse(code: string): MermaidStateAST {
    return parseMermaidStateDiagram(code);
  },
  serialize(ast: MermaidStateAST): string {
    return serializeMermaidStateDiagram(ast);
  },
  createDefault(direction = 'LR'): string {
    const dirLine = direction ? `    direction ${direction}\n` : '';
    return `stateDiagram-v2\n${dirLine}    [*] --> Idle\n    Idle --> Processing : Submit\n    Processing --> Success : Approve\n    Processing --> Failed : Reject\n    Success --> [*]\n    Failed --> Idle : Retry\n`;
  },
  clone: cloneStateAst,
  createEmpty: createEmptyStateAst,
  project: projectStateDiagram,
  getNodeLink(ast: MermaidStateAST, nodeId: string): string | undefined {
    return findNodeLinkUrl(
      ast.rawLines.map((r) => r.text),
      nodeId
    );
  },

  capabilities: {
    supportsDirection: true,
    supportsNodeKinds: true,
    supportsEdgeTypes: false,
    supportsEdgeStyles: false,
    supportsGroups: true,
    hasAnchors: true,
    supportsDefaultStyles: true,
  },

  labels: {
    node: 'State',
    nodes: 'States',
    edge: 'Transition',
    edges: 'Transitions',
    group: 'Composite',
    addNode: 'Add State',
    addGroup: 'Add Composite',
    addChild: 'Next State',
    insertNodeOnEdge: 'Insert State',
    edgeLabelPlaceholder: 'Event / Condition (e.g. onClick)...',
  },

  nodeKindOptions: STATE_KIND_OPTIONS,

  mutations: {
    addNode: (ast, label) => st.addState(ast, label),
    addChildNode: (ast, parentId, label) => st.addChildState(ast, parentId, label),
    deleteNode: (ast, nodeId) => {
      if (nodeId === '[*]') return;
      st.deleteState(ast, nodeId);
    },
    deleteNodes: (ast, nodeIds) => {
      st.deleteStates(ast, Array.from(nodeIds).filter((id) => id !== '[*]'));
    },
    updateNodeLabel: (ast, nodeId, label) => {
      st.updateStateLabel(ast, nodeId, label);
    },
    isNodeTextEditable: (ast, nodeId) =>
      st.isStateTextEditable(ast.states.get(nodeId)),
    updateNodeKind: (ast, nodeId, kind) => {
      st.updateStateType(ast, nodeId, kind as MermaidStateType);
    },
    updateNodesKind: (ast, nodeIds, kind) => {
      for (const id of nodeIds) {
        st.updateStateType(ast, id, kind as MermaidStateType);
      }
    },

    connect: (ast, fromId, toId) => {
      st.connectStates(ast, fromId, toId);
    },
    canConnect: (ast, fromId, toId) => st.canConnectStates(ast, fromId, toId),
    deleteEdge: (ast, edgeId) => {
      st.deleteTransition(ast, edgeId);
    },
    deleteEdges: (ast, edgeIds) => {
      st.deleteTransitions(ast, edgeIds);
    },
    updateEdgeLabel: (ast, edgeId, label) => {
      st.updateTransitionLabel(ast, edgeId, label);
    },
    reverseEdge: (ast, edgeId) => {
      const tr = ast.transitions.find((t) => t.id === edgeId);
      if (!tr) return null;
      // Only outer nodes can point to composites; inner nodes cannot point to outer composite.
      if (ast.compositeStates.has(tr.from) && st.isNodeInsideComposite(ast, tr.to, tr.from)) {
        return null;
      }
      if (st.areInDifferentComposites(ast, tr.to, tr.from)) {
        return null;
      }
      const oldFrom = tr.from;
      tr.from = tr.to;
      tr.to = oldFrom;
      return tr.id;
    },
    insertNodeOnEdge: (ast, edgeId, label) =>
      st.insertStateOnTransition(ast, edgeId, label),

    getNodeStyle: (ast, nodeId) => st.getStateStyle(ast, nodeId),
    updateNodeStyle: (ast, nodeId, styles) => {
      if (styles && Object.keys(styles).length > 0) {
        st.updateStateStyle(ast, nodeId, styles);
      } else {
        st.clearStateStyle(ast, nodeId);
      }
    },
    updateNodesStyle: (ast, nodeIds, styles) => {
      const ids = Array.from(nodeIds).filter((id) => id !== '[*]');
      if (styles && Object.keys(styles).length > 0) {
        st.updateStatesStyle(ast, ids, styles);
      } else {
        st.clearStatesStyle(ast, ids);
      }
    },
    clearNodeStyle: (ast, nodeId) => {
      st.clearStateStyle(ast, nodeId);
    },
    clearNodesStyle: (ast, nodeIds) => {
      st.clearStatesStyle(ast, nodeIds);
    },

    getDefaultStyle: (ast) => st.getDefaultStateStyle(ast),
    updateDefaultStyle: (ast, styles) => {
      st.updateDefaultStateStyle(ast, styles);
    },
    clearDefaultStyle: (ast) => {
      st.clearDefaultStateStyle(ast);
    },

    getGroupStyle: (ast, groupId) => st.getCompositeStateStyle(ast, groupId),
    updateGroupStyle: (ast, groupId, styles) => {
      if (styles && Object.keys(styles).length > 0) {
        st.updateCompositeStateStyle(ast, groupId, styles);
      } else {
        st.clearCompositeStateStyle(ast, groupId);
      }
    },
    clearGroupStyle: (ast, groupId) => {
      st.clearCompositeStateStyle(ast, groupId);
    },
    createGroup: (ast, label) => {
      const compId = st.createCompositeState(ast, label);
      st.addState(ast, 'State 1', 'normal', compId);
      return compId;
    },
    createGroupWithMembers: (ast, label, nodeIds) =>
      st.createCompositeWithMembers(ast, label, nodeIds),
    deleteGroup: (ast, groupId, deleteMembers) => {
      st.deleteCompositeState(ast, groupId, deleteMembers);
    },
    renameGroup: (ast, groupId, label) => {
      st.renameCompositeState(ast, groupId, label);
    },
    moveNodeToGroup: (ast, nodeId, groupId) => {
      st.moveStateToComposite(ast, nodeId, groupId || undefined);
    },
    moveNodesToGroup: (ast, nodeIds, groupId) => {
      for (const nid of nodeIds) {
        st.moveStateToComposite(ast, nid, groupId || undefined);
      }
    },

    duplicateNodes: (ast, nodeIds) => {
      const res = st.duplicateStates(ast, nodeIds);
      return { nodeIds: res.stateIds, edgeIds: res.transitionIds };
    },

    getDirection: (ast) => ast.direction,
    setDirection: (ast, direction) => {
      st.setStateDiagramDirection(ast, direction as StateDirection);
    },
    getTheme: (ast) => getDiagramTheme(ast.frontmatter),
    setTheme: (ast, theme) => {
      ast.frontmatter = setDiagramTheme(ast.frontmatter, theme);
    },

    anchors: {
      isAnchor: (nodeId) => nodeId === '[*]' || nodeId.startsWith('[*]:'),
      has: (ast, kind, compositeId) =>
        kind === 'start'
          ? st.hasStartState(ast, compositeId)
          : st.hasEndState(ast, compositeId),
      add: (ast, kind, compositeId) =>
        kind === 'start'
          ? st.addStartState(ast, 'New State', compositeId)
          : st.addEndState(ast, 'New State', compositeId),
      connectToEnd: (ast, nodeId) => {
        st.connectToEndState(ast, nodeId);
      },
      delete: (ast, kind, compositeId) => {
        if (kind === 'start') st.deleteStartAnchor(ast, compositeId);
        else if (kind === 'end') st.deleteEndAnchor(ast, compositeId);
        else {
          st.deleteStartAnchor(ast, compositeId);
          st.deleteEndAnchor(ast, compositeId);
        }
      },
    },
  },

  dom: stateDomAdapter,
};
