import {
  DiagramCapabilities,
  DiagramDriver,
  DiagramLabels,
  SupportedDiagramType,
  ViewProjection,
} from '../types';

export interface UnsupportedAst {
  rawCode: string;
}

const EMPTY_PROJECTION: ViewProjection = {
  nodes: new Map(),
  edges: [],
  subgraphs: new Map(),
  direction: undefined,
};

const VIEW_ONLY_CAPABILITIES: DiagramCapabilities = {
  editable: false,
  supportsDirection: false,
  supportsNodeKinds: false,
  supportsEdgeTypes: false,
  supportsEdgeStyles: false,
  supportsGroups: false,
  hasAnchors: false,
};

const VIEW_ONLY_LABELS: DiagramLabels = {
  node: 'Element',
  nodes: 'Elements',
  edge: 'Connection',
  edges: 'Connections',
  group: 'Group',
  addNode: 'Add Element',
  addGroup: 'Add Group',
  addChild: 'Next Element',
  insertNodeOnEdge: 'Insert Element',
  edgeLabelPlaceholder: '',
};

/**
 * Creates a safe fallback driver for diagrams that do not yet have visual editing support.
 * Renders Obsidian's native Mermaid output with full camera (pan/zoom/fit) capabilities,
 * while cleanly disabling all visual editing tools and AST mutations.
 */
export function createUnsupportedDiagramDriver(
  type: SupportedDiagramType,
  displayName: string = 'Mermaid Diagram'
): DiagramDriver<UnsupportedAst> {
  return {
    type,
    displayName,
    supportsDirection: false,
    canHandle: () => true,
    parse: (code: string): UnsupportedAst => ({ rawCode: code }),
    serialize: (ast: UnsupportedAst): string => ast?.rawCode ?? '',
    createDefault: () => '',
    clone: (ast: UnsupportedAst): UnsupportedAst => ({ ...ast }),
    createEmpty: (): UnsupportedAst => ({ rawCode: '' }),
    project: (): ViewProjection => EMPTY_PROJECTION,
    capabilities: VIEW_ONLY_CAPABILITIES,
    labels: VIEW_ONLY_LABELS,
    nodeKindOptions: [],
    mutations: {
      addNode: () => '',
      addChildNode: () => '',
      deleteNode: () => {},
      deleteNodes: () => {},
      updateNodeLabel: () => {},
      isNodeTextEditable: () => false,
      updateNodeKind: () => {},
      updateNodesKind: () => {},
      connect: () => {},
      canConnect: () => false,
      deleteEdge: () => {},
      deleteEdges: () => {},
      updateEdgeLabel: () => {},
      reverseEdge: () => null,
      insertNodeOnEdge: () => null,
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
      duplicateNodes: () => ({ nodeIds: [], edgeIds: [] }),
      getDirection: () => undefined,
      setDirection: () => {},
    },
    dom: {
      nodeIdPrefixes: [],
      isAnchorElement: () => false,
    },
  };
}
