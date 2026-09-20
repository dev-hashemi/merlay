/**
 * Mindmap Diagram Driver
 *
 * Implements the DiagramDriver contract for hierarchical mindmap trees.
 */

import { DiagramDriver, NodeKindOption, ViewProjection } from '../types';
import { MermaidEdgeDef, MermaidNodeDef } from '../viewModel';
import { matchesHeader, getDiagramTheme, setDiagramTheme } from '../common/diagramHeader';
import { findNodeLinkUrl } from '../nodeLinks';
import {
  MermaidMindmapAST,
  MindmapNode,
  mindmapShapeToViewModel,
} from './types';
import { createEmptyMindmapAst, parseMermaidMindmap } from './parser';
import { serializeMermaidMindmap } from './serializer';
import * as mm from './mutations';

export const MINDMAP_KIND_OPTIONS: NodeKindOption[] = [
  { kind: 'default', label: 'Default (No Border)' },
  { kind: 'circle', label: 'Circle' },
  { kind: 'rectangle', label: 'Rectangle' },
  { kind: 'rounded', label: 'Rounded Rect' },
  { kind: 'cloud', label: 'Cloud' },
  { kind: 'bang', label: 'Bang (Burst)' },
  { kind: 'hexagon', label: 'Hexagon' },
];

export function cloneMindmapAst(ast: MermaidMindmapAST): MermaidMindmapAST {
  const nodes = new Map<string, MindmapNode>();
  for (const [id, node] of ast.nodes.entries()) {
    nodes.set(id, {
      ...node,
      children: [...node.children],
    });
  }
  return {
    diagramType: 'mindmap',
    frontmatter: ast.frontmatter,
    root: ast.root ? (nodes.get(ast.root.id) ?? null) : null,
    nodes,
    rawLines: ast.rawLines.map((r) => ({ ...r })),
  };
}

export const MindmapDriver: DiagramDriver<MermaidMindmapAST> = {
  type: 'mindmap',
  displayName: 'Mindmap',
  supportsDirection: false,
  canHandle(code: string): boolean {
    return matchesHeader(code, /^mindmap\b/i);
  },
  parse(code: string): MermaidMindmapAST {
    return parseMermaidMindmap(code);
  },
  serialize(ast: MermaidMindmapAST): string {
    return serializeMermaidMindmap(ast);
  },
  createDefault(): string {
    return `mindmap\n  root((Central Topic))\n    Idea 1\n      Detail A\n      Detail B\n    Idea 2\n      Detail C\n`;
  },
  clone: cloneMindmapAst,
  createEmpty: createEmptyMindmapAst,

  project(ast: MermaidMindmapAST): ViewProjection {
    const nodes = new Map<string, MermaidNodeDef>();
    const edges: MermaidEdgeDef[] = [];

    if (ast.root) {
      function traverse(nodeId: string) {
        const node = ast.nodes.get(nodeId);
        if (!node) return;

        nodes.set(node.id, {
          type: 'node',
          id: node.id,
          label: node.label || node.id,
          shape: mindmapShapeToViewModel(node.shape),
          kind: node.shape,
          classes: node.className ? [node.className] : undefined,
        });

        for (const childId of node.children) {
          edges.push({
            type: 'edge',
            id: `edge_${node.id}_${childId}`,
            from: node.id,
            to: childId,
            arrowType: 'open',
          });
          traverse(childId);
        }
      }

      traverse(ast.root.id);
    }

    return {
      nodes,
      edges,
      subgraphs: new Map(),
      direction: undefined,
    };
  },

  getNodeLink(ast: MermaidMindmapAST, nodeId: string): string | undefined {
    return findNodeLinkUrl(
      ast.rawLines.map((r) => r.raw),
      nodeId
    );
  },

  capabilities: {
    supportsDirection: false,
    supportsNodeKinds: true,
    supportsEdgeTypes: false,
    supportsEdgeStyles: false,
    supportsGroups: false,
    hasAnchors: false,
    supportsNodeStyles: false,
  },

  canvasHint: {
    desktop:
      'Click + to sprout a subtopic • Drag to reparent • Double-click to rename',
    touch:
      'Tap + to sprout a subtopic • Drag to reparent • Double-tap to rename',
  },

  labels: {
    node: 'Topic',
    nodes: 'Topics',
    edge: 'Branch',
    edges: 'Branches',
    group: 'Section',
    addNode: 'Add Topic',
    addGroup: 'Add Section',
    addChild: 'Subtopic',
    insertNodeOnEdge: 'Insert Topic',
    edgeLabelPlaceholder: '',
  },

  nodeKindOptions: MINDMAP_KIND_OPTIONS,

  mutations: {
    addNode: (ast, label) => mm.addNode(ast, label),
    addChildNode: (ast, parentId, label) => mm.addChildNode(ast, parentId, label),
    deleteNode: (ast, nodeId) => mm.deleteNode(ast, nodeId),
    deleteNodes: (ast, nodeIds) => mm.deleteNodes(ast, nodeIds),
    updateNodeLabel: (ast, nodeId, label) => mm.updateNodeLabel(ast, nodeId, label),
    isNodeTextEditable: () => mm.isNodeTextEditable(),
    updateNodeKind: (ast, nodeId, kind) => mm.updateNodeKind(ast, nodeId, kind),
    updateNodesKind: (ast, nodeIds, kind) => mm.updateNodesKind(ast, nodeIds, kind),

    connect: (ast, fromId, toId) => mm.connect(ast, fromId, toId),
    canConnect: (ast, fromId, toId) => mm.canConnect(ast, fromId, toId),
    deleteEdge: (ast, edgeId) => mm.deleteEdge(ast, edgeId),
    deleteEdges: (ast, edgeIds) => mm.deleteEdges(ast, edgeIds),
    updateEdgeLabel: () => {},
    reverseEdge: () => null,
    insertNodeOnEdge: (ast, edgeId, label) => mm.insertNodeOnEdge(ast, edgeId, label),

    getNodeStyle: () => undefined,
    updateNodeStyle: () => {},
    updateNodesStyle: () => {},
    clearNodeStyle: () => {},
    clearNodesStyle: () => {},

    getGroupStyle: () => undefined,
    updateGroupStyle: () => {},
    clearGroupStyle: () => {},
    createGroup: () => '',
    createGroupWithMembers: () => '',
    deleteGroup: () => {},
    renameGroup: () => {},
    moveNodeToGroup: () => {},
    moveNodesToGroup: () => {},

    duplicateNodes: (ast, nodeIds) => mm.duplicateNodes(ast, nodeIds),

    getDirection: () => undefined,
    setDirection: () => {},
    getTheme: (ast) => getDiagramTheme(ast.frontmatter),
    setTheme: (ast, theme) => {
      ast.frontmatter = setDiagramTheme(ast.frontmatter, theme);
    },
  },

  dom: {
    nodeIdPrefixes: ['node_'],
    nodeSelector: '.node, [class*="mindmap-node"]',
    edgeSelector: '.edge, path.edge',
    resolveNodeId(el: Element, displayNodes: Map<string, MermaidNodeDef>): string | null {
      const container = el.closest?.('g.node, [class*="mindmap-node"]') || el;
      const idAttr = container.getAttribute?.('id') || el.getAttribute?.('id') || '';
      const match = idAttr.match(/(?:^|-)node_(\d+)$/);
      if (match) {
        const idx = parseInt(match[1], 10);
        const nodeIds = Array.from(displayNodes.keys());
        return nodeIds[idx] ?? null;
      }
      return null;
    },
  },
};
