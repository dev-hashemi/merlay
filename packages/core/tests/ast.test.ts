import test from 'node:test';
import assert from 'node:assert/strict';

import { tokenize } from '../src/diagrams/flowchart/lexer.ts';
import { parseMermaidFlowchart } from '../src/diagrams/flowchart/parser.ts';
import { serializeMermaidFlowchart } from '../src/diagrams/flowchart/serializer.ts';

import {
  addNode,
  addChildNode,
  connectNodes,
  deleteNode,
  deleteEdge,
  updateNodeLabel,
  updateEdgeLabel,
  updateEdgeType,
  reverseEdgeDirection,
  insertNodeOnEdge,
  insertNodeBetween,
  setDiagramDirection,
} from '../src/diagrams/flowchart/mutations';

test('Lexer tokenizes basic flowchart', () => {
  const code = 'flowchart LR\n    A[Start] --> B(End)';
  const tokens = tokenize(code);
  assert.ok(tokens.length > 0);
  assert.equal(tokens[0].type, 'DIRECTIVE');
  assert.equal(tokens[0].value, 'flowchart');
  assert.equal(tokens[1].type, 'DIRECTION');
  assert.equal(tokens[1].value, 'LR');
});

test('Parser creates AST with all node shapes and labels', () => {
  const code = `flowchart TD
    rect[Rectangle]
    round(Rounded)
    stad([Stadium])
    sub[[Subroutine]]
    cyl[(Database)]
    circ((Circle))
    diam{Decision}
    hex{{Hexagon}}
    para[/Parallelogram/]
    rect --> round
    round --> stad
    stad ==> sub
    sub -.-> cyl
    cyl <--> circ
    circ -->|Yes| diam
    diam -->|No| hex
    hex --- para
`;

  const ast = parseMermaidFlowchart(code);
  assert.equal(ast.direction, 'TD');
  assert.equal(ast.nodes.size, 9);
  assert.equal(ast.edges.length, 8);

  assert.equal(ast.nodes.get('rect')?.shape, 'rectangle');
  assert.equal(ast.nodes.get('round')?.shape, 'rounded');
  assert.equal(ast.nodes.get('stad')?.shape, 'stadium');
  assert.equal(ast.nodes.get('sub')?.shape, 'subroutine');
  assert.equal(ast.nodes.get('cyl')?.shape, 'cylinder');
  assert.equal(ast.nodes.get('circ')?.shape, 'circle');
  assert.equal(ast.nodes.get('diam')?.shape, 'diamond');
  assert.equal(ast.nodes.get('hex')?.shape, 'hexagon');
  assert.equal(ast.nodes.get('para')?.shape, 'parallelogram');

  assert.equal(ast.edges[5].label, 'Yes');
  assert.equal(ast.edges[6].label, 'No');
});

test('Parser handles chained connections A --> B --> C', () => {
  const code = `flowchart LR
    A["Node 1"] --> B["Node 2"] --> C["Node 3"]
`;

  const ast = parseMermaidFlowchart(code);
  assert.equal(ast.nodes.size, 3);
  assert.equal(ast.edges.length, 2);
  assert.equal(ast.edges[0].from, 'A');
  assert.equal(ast.edges[0].to, 'B');
  assert.equal(ast.edges[1].from, 'B');
  assert.equal(ast.edges[1].to, 'C');
});

test('Parser and Serializer handle Subgraphs cleanly', () => {
  const code = `flowchart LR
    subgraph backend ["Backend API"]
        direction TB
        Server["API Server"]
        DB[("PostgreSQL")]
    end

    Client["Client Web"] --> Server
    Server --> DB
`;

  const ast = parseMermaidFlowchart(code);
  assert.equal(ast.subgraphs.size, 1);
  const sub = ast.subgraphs.get('backend');
  assert.ok(sub);
  assert.equal(sub.label, 'Backend API');
  assert.equal(sub.nodeIds.length, 2);
  assert.equal(sub.direction, 'TB');

  const serialized = serializeMermaidFlowchart(ast);
  assert.ok(serialized.includes('subgraph backend ["Backend API"]'));
  assert.ok(serialized.includes('Client'));
  assert.ok(serialized.includes('Server'));
});

test('Parser and Serializer handle Styles and ClassDefs', () => {
  const code = `flowchart LR
    A["Server"] --> B["Database"]

    classDef primary fill:#3b82f6,color:#fff
    style A fill:#10b981,stroke:#047857
`;

  const ast = parseMermaidFlowchart(code);
  assert.equal(ast.styles.length, 1);
  assert.equal(ast.styles[0].targetId, 'A');
  assert.equal(ast.styles[0].styles.fill, '#10b981');
  assert.equal(ast.classDefs.size, 1);
  assert.equal(ast.classDefs.get('primary')?.styles.fill, '#3b82f6');

  const serialized = serializeMermaidFlowchart(ast);
  assert.ok(serialized.includes('style A fill:#10b981,stroke:#047857'));
  assert.ok(serialized.includes('classDef primary fill:#3b82f6,color:#fff'));
});

test('Round-trip semantic idempotency', () => {
  const original = `flowchart LR
    A["Step 1"] -->|next| B["Step 2"]
    B --> C["Step 3"]
`;

  const ast1 = parseMermaidFlowchart(original);
  const serialized1 = serializeMermaidFlowchart(ast1);
  const ast2 = parseMermaidFlowchart(serialized1);
  const serialized2 = serializeMermaidFlowchart(ast2);

  assert.equal(serialized1, serialized2);
  assert.equal(ast1.nodes.size, ast2.nodes.size);
  assert.equal(ast1.edges.length, ast2.edges.length);
});

test('Parser and Serializer handle multiline and special characters cleanly', () => {
  const code = `flowchart TD
    A["Line 1\\nLine 2"] --> B["Card with (parens) and [brackets]"]
`;

  const ast = parseMermaidFlowchart(code);
  assert.equal(ast.nodes.size, 2);
  assert.equal(ast.edges.length, 1);

  const serialized = serializeMermaidFlowchart(ast);
  assert.ok(serialized.includes('Line 1\\nLine 2'));
  assert.ok(serialized.includes('Card with (parens) and [brackets]'));
});

test('AST Mutations: addNode, addChildNode, connectNodes, deleteNode, deleteEdge, updateLabels', () => {
  const code = 'flowchart LR\n    A[Step 1] --> B[Step 2]';
  const ast = parseMermaidFlowchart(code);

  // 1. addNode
  const standaloneId = addNode(ast, 'Standalone Step');
  assert.ok(ast.nodes.has(standaloneId));
  assert.equal(ast.nodes.get(standaloneId)?.label, 'Standalone Step');

  // 2. addChildNode (relational sprout)
  const { nodeId: childId, edgeId } = addChildNode(ast, 'B', 'Next Step');
  assert.ok(ast.nodes.has(childId));
  assert.equal(ast.nodes.get(childId)?.label, 'Next Step');
  const sproutEdge = ast.edges.find((e) => e.id === edgeId);
  assert.ok(sproutEdge);
  assert.equal(sproutEdge.from, 'B');
  assert.equal(sproutEdge.to, childId);

  // 3. connectNodes (supports multiple edges between same nodes)
  const newEdgeId = connectNodes(ast, standaloneId, 'A', 'arrow', 'Prereq');
  assert.ok(newEdgeId);
  const connEdge = ast.edges.find((e) => e.id === newEdgeId);
  assert.ok(connEdge);
  assert.equal(connEdge.from, standaloneId);
  assert.equal(connEdge.to, 'A');
  assert.equal(connEdge.label, 'Prereq');

  const secondEdgeId = connectNodes(ast, standaloneId, 'A', 'dotted', 'Secondary');
  assert.ok(secondEdgeId);
  assert.notEqual(secondEdgeId, newEdgeId);
  assert.equal(ast.edges.filter((e) => e.from === standaloneId && e.to === 'A').length, 2);

  // 4. updateNodeLabel & updateEdgeLabel
  updateNodeLabel(ast, standaloneId, 'Initial Start');
  assert.equal(ast.nodes.get(standaloneId)?.label, 'Initial Start');
  updateEdgeLabel(ast, newEdgeId, 'Requires');
  assert.equal(connEdge.label, 'Requires');

  // 5. deleteEdge
  deleteEdge(ast, newEdgeId);
  assert.ok(!ast.edges.some((e) => e.id === newEdgeId));

  // 6. deleteNode (cascades to edges)
  deleteNode(ast, 'B');
  assert.ok(!ast.nodes.has('B'));
  assert.ok(!ast.edges.some((e) => e.from === 'B' || e.to === 'B'));

  // 7. setDiagramDirection
  setDiagramDirection(ast, 'TD');
  assert.equal(ast.direction, 'TD');

  const serialized = serializeMermaidFlowchart(ast);
  assert.ok(serialized.startsWith('flowchart TD'));
  assert.ok(serialized.includes('Initial Start'));
  assert.ok(serialized.includes('Next Step'));
});

test('AST Mutations: updateEdgeType, reverseEdgeDirection, and insertNodeOnEdge', () => {
  const code = 'flowchart LR\n    A[Step 1] -->|condition| B[Step 2]';
  const ast = parseMermaidFlowchart(code);
  assert.equal(ast.edges.length, 1);
  const edge = ast.edges[0];

  // 1. updateEdgeType
  updateEdgeType(ast, edge.id, 'dotted');
  assert.equal(edge.arrowType, 'dotted');
  let serialized = serializeMermaidFlowchart(ast);
  assert.ok(serialized.includes('A -.->|condition| B'));

  updateEdgeType(ast, edge.id, 'thick');
  assert.equal(edge.arrowType, 'thick');
  serialized = serializeMermaidFlowchart(ast);
  assert.ok(serialized.includes('A ==>'));

  // 2. reverseEdgeDirection
  const newEdgeId = reverseEdgeDirection(ast, edge.id);
  assert.ok(newEdgeId);
  const reversedEdge = ast.edges.find((e) => e.id === newEdgeId);
  assert.ok(reversedEdge);
  assert.equal(reversedEdge.from, 'B');
  assert.equal(reversedEdge.to, 'A');
  assert.equal(reversedEdge.arrowType, 'thick');
  assert.equal(reversedEdge.label, 'condition');

  // 3. insertNodeOnEdge (inserts node between B and A)
  const insertRes = insertNodeOnEdge(ast, newEdgeId, 'Intermediate Step');
  assert.ok(insertRes);
  assert.ok(ast.nodes.has(insertRes.nodeId));
  assert.equal(ast.nodes.get(insertRes.nodeId)?.label, 'Intermediate Step');
  assert.equal(ast.edges.length, 2);

  const edge1 = ast.edges.find((e) => e.id === insertRes.edge1Id);
  const edge2 = ast.edges.find((e) => e.id === insertRes.edge2Id);
  assert.ok(edge1);
  assert.ok(edge2);
  assert.equal(edge1.from, 'B');
  assert.equal(edge1.to, insertRes.nodeId);
  assert.equal(edge2.from, insertRes.nodeId);
  assert.equal(edge2.to, 'A');

  serialized = serializeMermaidFlowchart(ast);
  assert.ok(serialized.includes('Intermediate Step'));
});

