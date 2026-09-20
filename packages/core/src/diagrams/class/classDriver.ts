/**
 * Mermaid Class Diagram Driver
 *
 * Implements DiagramDriver<MermaidClassAST> for class diagrams.
 */

import { DiagramDriver, ViewProjection } from '../types';
import { ArrowType, FlowchartDirection, MermaidEdgeDef, MermaidNodeDef, MermaidSubgraphDef } from '../viewModel';
import { getDiagramTheme, matchesHeader, setDiagramTheme } from '../common/diagramHeader';
import { findNodeLinkUrl } from '../nodeLinks';
import { ClassDirection, MermaidClassAST } from './types';
import { parseMermaidClassDiagram } from './parser';
import { serializeMermaidClassDiagram } from './serializer';
import * as cm from './mutations';

const CLASS_KIND_OPTIONS = [
  { kind: 'class', label: 'Class' },
  { kind: 'interface', label: 'Interface <<interface>>' },
  { kind: 'abstract', label: 'Abstract <<abstract>>' },
  { kind: 'service', label: 'Service <<service>>' },
  { kind: 'enum', label: 'Enum <<enumeration>>' },
];

function cloneClassAst(ast: MermaidClassAST): MermaidClassAST {
  return {
    ...ast,
    frontmatter: ast.frontmatter,
    classes: new Map(
      Array.from(ast.classes.entries(), ([id, c]) => [
        id,
        {
          ...c,
          members: c.members.map((m) => ({ ...m })),
          annotations: c.annotations ? [...c.annotations] : [],
          classes: c.classes ? [...c.classes] : [],
          style: c.style ? { ...c.style } : undefined,
        },
      ])
    ),
    relationships: ast.relationships.map((r) => ({ ...r })),
    namespaces: new Map(
      Array.from(ast.namespaces.entries(), ([id, ns]) => [
        id,
        { ...ns, classIds: [...ns.classIds] },
      ])
    ),
    styles: ast.styles.map((s) => ({ ...s, styles: { ...s.styles } })),
    rawLines: ast.rawLines.map((r) => ({ ...r })),
  };
}

function createEmptyClassAst(): MermaidClassAST {
  return {
    diagramType: 'classDiagram',
    frontmatter: undefined,
    direction: undefined,
    classes: new Map(),
    relationships: [],
    namespaces: new Map(),
    styles: [],
    rawLines: [],
  };
}

export const ClassDiagramDriver: DiagramDriver<MermaidClassAST> = {
  type: 'classDiagram',
  displayName: 'Class Diagram',
  supportsDirection: true,

  canHandle(code: string): boolean {
    return matchesHeader(code, /^classDiagram(-v2)?\b/i);
  },

  parse(code: string): MermaidClassAST {
    return parseMermaidClassDiagram(code);
  },

  serialize(ast: MermaidClassAST): string {
    return serializeMermaidClassDiagram(ast);
  },

  createDefault(direction = 'LR'): string {
    const dirLine = direction ? `    direction ${direction}\n` : '';
    return `classDiagram\n${dirLine}    class Animal {\n        +String name\n        +move()\n    }\n    class Duck {\n        +quack()\n    }\n    Animal <|-- Duck\n`;
  },

  clone: cloneClassAst,
  createEmpty: createEmptyClassAst,

  project(ast: MermaidClassAST): ViewProjection {
    const nodes = new Map<string, MermaidNodeDef>();
    for (const [id, cls] of ast.classes.entries()) {
      nodes.set(id, {
        type: 'node',
        id,
        label: cls.label || id,
        shape: 'rectangle',
        kind: cls.kind || 'class',
        subgraphId: cls.namespaceId,
        style: cls.style,
        classes: cls.classes,
      });
    }

    const edges: MermaidEdgeDef[] = ast.relationships.map((rel) => {
      let arrowType: ArrowType = 'arrow';
      if (rel.rawRelation.includes('..')) {
        if (rel.leftEnd && rel.rightEnd) {
          arrowType = 'bidirectional';
        } else if (rel.leftEnd || rel.rightEnd) {
          arrowType = 'dotted';
        } else {
          arrowType = 'dotted_open';
        }
      } else {
        if (rel.leftEnd && rel.rightEnd) {
          arrowType = 'bidirectional';
        } else if (rel.leftEnd || rel.rightEnd) {
          arrowType = 'arrow';
        } else {
          arrowType = 'open';
        }
      }

      return {
        type: 'edge',
        id: rel.id,
        from: rel.from,
        to: rel.to,
        arrowType,
        label: rel.label,
      };
    });

    const subgraphs = new Map<string, MermaidSubgraphDef>();
    for (const [id, ns] of ast.namespaces.entries()) {
      subgraphs.set(id, {
        type: 'subgraph',
        id,
        label: ns.label || id,
        direction: (ast.direction || 'TD') as FlowchartDirection,
        nodeIds: [...ns.classIds],
        subgraphIds: [],
      });
    }

    return {
      nodes,
      edges,
      subgraphs,
      direction: ast.direction,
    };
  },

  getNodeLink(ast: MermaidClassAST, nodeId: string): string | undefined {
    return findNodeLinkUrl(
      ast.rawLines.map((r) => r.raw),
      nodeId
    );
  },

  capabilities: {
    supportsDirection: true,
    supportsNodeKinds: true,
    supportsEdgeTypes: true,
    supportsEdgeStyles: false,
    supportsGroups: true,
    hasAnchors: false,
    supportsDefaultStyles: true,
    supportsNodeStyles: true,
    supportsNodeMembers: true,
  },

  labels: {
    node: 'Class',
    nodes: 'Classes',
    edge: 'Relationship',
    edges: 'Relationships',
    group: 'Namespace',
    addNode: 'Add Class',
    addGroup: 'Add Namespace',
    addChild: 'Subclass',
    insertNodeOnEdge: 'Insert Class',
    edgeLabelPlaceholder: 'Multiplicity / Label (e.g. 1..* or inherits)...',
    member: 'Row',
    members: 'Rows',
    addMember: 'Add Row',
  },

  nodeKindOptions: CLASS_KIND_OPTIONS,

  mutations: {
    addNode: (ast, label) => cm.addClass(ast, label),
    addChildNode: (ast, parentId, label) => cm.addChildClass(ast, parentId, label),
    deleteNode: (ast, nodeId) => cm.deleteClass(ast, nodeId),
    deleteNodes: (ast, nodeIds) => cm.deleteClasses(ast, nodeIds),
    updateNodeLabel: (ast, nodeId, label) => cm.updateClassLabel(ast, nodeId, label),
    isNodeTextEditable: (ast, nodeId) => cm.isClassTextEditable(ast.classes.get(nodeId)),
    updateNodeKind: (ast, nodeId, kind) => cm.updateClassKind(ast, nodeId, kind),
    updateNodesKind: (ast, nodeIds, kind) => cm.updateClassesKind(ast, nodeIds, kind),

    getNodeMemberCapabilities: (ast, nodeId) => cm.getClassMemberCapabilities(ast, nodeId),
    getNodeMembers: (ast, nodeId) => cm.getClassMembers(ast, nodeId),
    setNodeMembers: (ast, nodeId, kind, members) =>
      cm.setClassMembers(ast, nodeId, kind, members),
    addNodeMember: (ast, nodeId, kind, rawText, afterIndex) =>
      cm.addClassMember(ast, nodeId, kind, rawText, afterIndex),
    updateNodeMember: (ast, nodeId, kind, index, rawText) =>
      cm.updateClassMember(ast, nodeId, kind, index, rawText),
    deleteNodeMember: (ast, nodeId, kind, index) =>
      cm.deleteClassMember(ast, nodeId, kind, index),

    connect: (ast, fromId, toId) => cm.connectClasses(ast, fromId, toId),
    canConnect: (ast, fromId, toId) => cm.canConnectClasses(ast, fromId, toId),
    deleteEdge: (ast, edgeId) => cm.deleteRelationship(ast, edgeId),
    deleteEdges: (ast, edgeIds) => cm.deleteRelationships(ast, edgeIds),
    updateEdgeLabel: (ast, edgeId, label) => cm.updateRelationshipLabel(ast, edgeId, label),
    reverseEdge: (ast, edgeId) => cm.reverseRelationship(ast, edgeId),
    insertNodeOnEdge: (ast, edgeId, label) => cm.insertClassOnRelationship(ast, edgeId, label),
    updateEdgeType: (ast, edgeId, type) => cm.updateRelationshipType(ast, edgeId, type),

    getNodeStyle: (ast, nodeId) => cm.getClassStyle(ast, nodeId),
    updateNodeStyle: (ast, nodeId, styles) => cm.updateClassStyle(ast, nodeId, styles),
    updateNodesStyle: (ast, nodeIds, styles) => cm.updateClassesStyle(ast, nodeIds, styles),
    clearNodeStyle: (ast, nodeId) => cm.clearClassStyle(ast, nodeId),
    clearNodesStyle: (ast, nodeIds) => cm.clearClassesStyle(ast, nodeIds),

    getDefaultStyle: (ast) => cm.getDefaultClassStyle(ast),
    updateDefaultStyle: (ast, styles) => cm.updateDefaultClassStyle(ast, styles),
    clearDefaultStyle: (ast) => cm.clearDefaultClassStyle(ast),

    getGroupStyle: () => undefined,
    updateGroupStyle: () => {},
    clearGroupStyle: () => {},
    createGroup: (ast, label) => cm.createNamespace(ast, label),
    createGroupWithMembers: (ast, label, nodeIds) => cm.createNamespaceWithMembers(ast, label, nodeIds),
    deleteGroup: (ast, groupId, deleteMembers) => cm.deleteNamespace(ast, groupId, deleteMembers),
    renameGroup: (ast, groupId, label) => cm.renameNamespace(ast, groupId, label),
    moveNodeToGroup: (ast, nodeId, groupId) => cm.moveClassToNamespace(ast, nodeId, groupId),
    moveNodesToGroup: (ast, nodeIds, groupId) => cm.moveClassesToNamespace(ast, nodeIds, groupId),

    duplicateNodes: (ast, nodeIds) => cm.duplicateClasses(ast, nodeIds),

    getDirection: (ast) => ast.direction,
    setDirection: (ast, direction) => {
      ast.direction = direction as ClassDirection;
    },
    getTheme: (ast) => getDiagramTheme(ast.frontmatter),
    setTheme: (ast, theme) => {
      ast.frontmatter = setDiagramTheme(ast.frontmatter, theme);
    },
  },

  dom: {
    nodeIdPrefixes: ['classId-', 'class-'],
    clusterSelector: '.cluster',
    clusterIdPrefixes: [''],
    nodeSelector: '.node, [id*="classId-"]',
  },
};
