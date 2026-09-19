/**
 * Flowchart driver: wires the flowchart parser/serializer and the flowchart
 * AST mutations into the unified DiagramDriver contract.
 */

import { DiagramDriver } from '../types';
import {
  ArrowType,
  FlowchartDirection,
  MermaidFlowchartAST,
  MermaidShapeType,
} from './types';
import { parseMermaidFlowchart } from './parser';
import { serializeMermaidFlowchart } from './serializer';
import { findNodeLinkUrl } from '../nodeLinks';
import { matchesHeader, getDiagramTheme, setDiagramTheme } from '../common/diagramHeader';
import * as fc from './mutations';

export const FLOWCHART_KIND_OPTIONS = [
  { kind: 'rectangle', label: 'Rectangle [ ]' },
  { kind: 'rounded', label: 'Rounded ( )' },
  { kind: 'stadium', label: 'Stadium ([ ])' },
  { kind: 'subroutine', label: 'Subroutine [[ ]]' },
  { kind: 'cylinder', label: 'Database [( )]' },
  { kind: 'circle', label: 'Circle (( ))' },
  { kind: 'double_circle', label: 'Double Circle ((( )))' },
  { kind: 'diamond', label: 'Decision { }' },
  { kind: 'hexagon', label: 'Hexagon {{ }}' },
  { kind: 'parallelogram', label: 'Parallelogram [/ /]' },
  { kind: 'parallelogram_alt', label: 'Parallelogram [\\ \\]' },
  { kind: 'trapezoid', label: 'Trapezoid [/ \\]' },
  { kind: 'trapezoid_alt', label: 'Inv. Trapezoid [\\ /]' },
  { kind: 'asymmetric', label: 'Banner > ]' },
] as const;

function cloneFlowchartAst(ast: MermaidFlowchartAST): MermaidFlowchartAST {
  return {
    ...ast,
    frontmatter: ast.frontmatter,
    nodes: new Map(Array.from(ast.nodes, ([id, n]) => [id, { ...n }])),
    edges: ast.edges.map((e) => ({ ...e })),
    subgraphs: new Map(
      Array.from(ast.subgraphs, ([id, s]) => [
        id,
        { ...s, nodeIds: [...s.nodeIds], subgraphIds: [...s.subgraphIds] },
      ])
    ),
    styles: ast.styles.map((s) => ({ ...s, styles: { ...s.styles } })),
    classDefs: new Map(Array.from(ast.classDefs, ([id, c]) => [id, { ...c }])),
    defaultLinkStyle: ast.defaultLinkStyle ? { ...ast.defaultLinkStyle } : undefined,
    rawLines: [...ast.rawLines],
  };
}

function createEmptyFlowchartAst(): MermaidFlowchartAST {
  return {
    diagramType: 'flowchart',
    frontmatter: undefined,
    direction: 'TD',
    nodes: new Map(),
    edges: [],
    subgraphs: new Map(),
    styles: [],
    classDefs: new Map(),
    rawLines: [],
  };
}

export const FlowchartDriver: DiagramDriver<MermaidFlowchartAST> = {
  type: 'flowchart',
  displayName: 'Flowchart',
  supportsDirection: true,
  canHandle(code: string): boolean {
    return matchesHeader(code, /^(flowchart|graph)\b/i);
  },
  parse(code: string): MermaidFlowchartAST {
    return parseMermaidFlowchart(code);
  },
  serialize(ast: MermaidFlowchartAST): string {
    return serializeMermaidFlowchart(ast);
  },
  createDefault(direction = 'LR'): string {
    return `flowchart ${direction}\n    A["Start"] --> B["Process"]\n    B --> C["End"]\n`;
  },
  clone: cloneFlowchartAst,
  createEmpty: createEmptyFlowchartAst,
  project(ast: MermaidFlowchartAST) {
    return {
      nodes: ast.nodes,
      edges: ast.edges,
      subgraphs: ast.subgraphs,
      direction: ast.direction,
    };
  },
  getNodeLink(ast: MermaidFlowchartAST, nodeId: string): string | undefined {
    return findNodeLinkUrl(
      ast.rawLines.map((r) => r.text),
      nodeId
    );
  },

  capabilities: {
    supportsDirection: true,
    supportsNodeKinds: true,
    supportsEdgeTypes: true,
    supportsEdgeStyles: true,
    supportsGroups: true,
    hasAnchors: false,
    supportsDefaultStyles: true,
  },

  labels: {
    node: 'Step',
    nodes: 'Steps',
    edge: 'Connection',
    edges: 'Arrows',
    group: 'Group',
    addNode: 'Add Step',
    addGroup: 'Add Group',
    addChild: 'Next Step',
    insertNodeOnEdge: 'Insert Step',
    edgeLabelPlaceholder: 'Caption (e.g. Yes/No)...',
  },

  nodeKindOptions: FLOWCHART_KIND_OPTIONS.map((o) => ({ ...o })),

  mutations: {
    addNode: (ast, label) => fc.addNode(ast, label),
    addChildNode: (ast, parentId, label) => fc.addChildNode(ast, parentId, label).nodeId,
    deleteNode: (ast, nodeId) => {
      fc.deleteNode(ast, nodeId);
    },
    deleteNodes: (ast, nodeIds) => {
      fc.deleteNodes(ast, nodeIds);
    },
    updateNodeLabel: (ast, nodeId, label) => {
      fc.updateNodeLabel(ast, nodeId, label);
    },
    isNodeTextEditable: () => true,
    updateNodeKind: (ast, nodeId, kind) => {
      fc.updateNodeShape(ast, nodeId, kind as MermaidShapeType);
    },
    updateNodesKind: (ast, nodeIds, kind) => {
      fc.updateNodesShape(ast, nodeIds, kind as MermaidShapeType);
    },

    connect: (ast, fromId, toId) => {
      fc.connectNodes(ast, fromId, toId);
    },
    // Official Mermaid allows edges between any flowchart nodes, including
    // across subgraphs — only state composites restrict connections.
    canConnect: () => true,
    deleteEdge: (ast, edgeId) => {
      fc.deleteEdge(ast, edgeId);
    },
    deleteEdges: (ast, edgeIds) => {
      fc.deleteEdges(ast, edgeIds);
    },
    updateEdgeLabel: (ast, edgeId, label) => {
      fc.updateEdgeLabel(ast, edgeId, label);
    },
    reverseEdge: (ast, edgeId) => fc.reverseEdgeDirection(ast, edgeId),
    insertNodeOnEdge: (ast, edgeId, label) => {
      const res = fc.insertNodeOnEdge(ast, edgeId, label);
      return res ? res.nodeId : null;
    },
    updateEdgeType: (ast, edgeId, type) => {
      fc.updateEdgeType(ast, edgeId, type as ArrowType);
    },
    updateEdgesType: (ast, edgeIds, type) => {
      fc.updateEdgesType(ast, edgeIds, type as ArrowType);
    },

    getNodeStyle: (ast, nodeId) => fc.getNodeStyle(ast, nodeId),
    updateNodeStyle: (ast, nodeId, styles) => {
      fc.updateNodeStyle(ast, nodeId, styles);
    },
    updateNodesStyle: (ast, nodeIds, styles) => {
      fc.updateNodesStyle(ast, nodeIds, styles);
    },
    clearNodeStyle: (ast, nodeId) => {
      fc.clearNodeStyle(ast, nodeId);
    },
    clearNodesStyle: (ast, nodeIds) => {
      fc.clearNodesStyle(ast, nodeIds);
    },

    getEdgeStyle: (ast, edgeId) => fc.getEdgeStyle(ast, edgeId),
    updateEdgeStyle: (ast, edgeId, styles) => {
      fc.updateEdgeStyle(ast, edgeId, styles);
    },
    updateEdgesStyle: (ast, edgeIds, styles) => {
      fc.updateEdgesStyle(ast, edgeIds, styles);
    },
    clearEdgeStyle: (ast, edgeId) => {
      fc.clearEdgeStyle(ast, edgeId);
    },
    clearEdgesStyle: (ast, edgeIds) => {
      fc.clearEdgesStyle(ast, edgeIds);
    },

    getDefaultStyle: (ast) => fc.getDefaultNodeStyle(ast),
    updateDefaultStyle: (ast, styles) => {
      fc.updateDefaultNodeStyle(ast, styles);
    },
    clearDefaultStyle: (ast) => {
      fc.clearDefaultNodeStyle(ast);
    },
    getDefaultEdgeStyle: (ast) => fc.getDefaultEdgeStyle(ast),
    updateDefaultEdgeStyle: (ast, styles) => {
      fc.updateDefaultEdgeStyle(ast, styles);
    },
    clearDefaultEdgeStyle: (ast) => {
      fc.clearDefaultEdgeStyle(ast);
    },

    getGroupStyle: (ast, groupId) => fc.getSubgraphStyle(ast, groupId),
    updateGroupStyle: (ast, groupId, styles) => {
      fc.updateSubgraphStyle(ast, groupId, styles);
    },
    clearGroupStyle: (ast, groupId) => {
      fc.clearSubgraphStyle(ast, groupId);
    },
    createGroup: (ast, label) => {
      const nodeId = fc.addNode(ast, 'Step 1');
      return fc.createSubgraph(ast, label, [nodeId]);
    },
    createGroupWithMembers: (ast, label, nodeIds) =>
      fc.createSubgraph(ast, label, nodeIds),
    deleteGroup: (ast, groupId, deleteMembers) => {
      fc.deleteSubgraph(ast, groupId, deleteMembers);
    },
    renameGroup: (ast, groupId, label) => {
      fc.renameSubgraph(ast, groupId, label);
    },
    moveNodeToGroup: (ast, nodeId, groupId) => {
      fc.moveNodeToSubgraph(ast, nodeId, groupId);
    },
    moveNodesToGroup: (ast, nodeIds, groupId) => {
      fc.moveNodesToSubgraph(ast, nodeIds, groupId);
    },

    duplicateNodes: (ast, nodeIds) => fc.duplicateNodes(ast, nodeIds),

    getDirection: (ast) => ast.direction,
    setDirection: (ast, direction) => {
      fc.setDiagramDirection(ast, direction as FlowchartDirection);
    },
    getTheme: (ast) => getDiagramTheme(ast.frontmatter),
    setTheme: (ast, theme) => {
      ast.frontmatter = setDiagramTheme(ast.frontmatter, theme);
    },
  },

  dom: {
    nodeIdPrefixes: ['flowchart-'],
  },
};
