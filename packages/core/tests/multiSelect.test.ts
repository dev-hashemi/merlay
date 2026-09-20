import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMermaidFlowchart } from '../src/diagrams/flowchart/parser';
import { serializeMermaidFlowchart } from '../src/diagrams/flowchart/serializer';
import {
  deleteNodes,
  updateNodesShape,
  updateNodesStyle,
  clearNodesStyle,
  getNodeStyle,
  updateEdgesType,
  updateEdgesStyle,
  clearEdgesStyle,
  deleteEdges,
  getEdgeStyle,
} from '../src/diagrams/flowchart/mutations';

test('Multi-Select Batch Mutations: deleteNodes removes multiple nodes and cascades edges', () => {
  const initial = `flowchart TD
  A[Start] --> B[Task 1]
  B --> C[Task 2]
  C --> D[Task 3]
  D --> E[End]
  A --> C
  B --> E`;

  const ast = parseMermaidFlowchart(initial);
  assert.equal(ast.nodes.size, 5);
  assert.equal(ast.edges.length, 6);

  // Batch delete nodes B and C
  const deletedCount = deleteNodes(ast, ['B', 'C']);
  assert.equal(deletedCount, 2);
  assert.equal(ast.nodes.has('B'), false);
  assert.equal(ast.nodes.has('C'), false);
  assert.equal(ast.nodes.has('A'), true);
  assert.equal(ast.nodes.has('D'), true);
  assert.equal(ast.nodes.has('E'), true);

  // Edges connecting B or C (A-->B, B-->C, C-->D, A-->C, B-->E) must all be removed
  // Only remaining edge should be D --> E!
  assert.equal(ast.edges.length, 1);
  assert.equal(ast.edges[0].from, 'D');
  assert.equal(ast.edges[0].to, 'E');

  const serialized = serializeMermaidFlowchart(ast);
  assert.ok(serialized.includes('D --> E'));
  assert.ok(serialized.includes('D["Task 3"]'));
  assert.ok(serialized.includes('E["End"]'));
  assert.ok(!serialized.includes('Task 1'));
  assert.ok(!serialized.includes('Task 2'));
});

test('Multi-Select Batch Mutations: deleteNodes cleans subgraphs and styles', () => {
  const code = `flowchart TD
  subgraph Cluster["Backend Services"]
    API[API Gateway]
    Auth[Auth Service]
    Worker[Background Worker]
  end
  Client --> API
  API --> Auth
  API --> Worker
  style Auth fill:#fef3c7,stroke:#f59e0b
  style Worker fill:#ecfdf5,stroke:#10b981`;

  const ast = parseMermaidFlowchart(code);
  const cluster = ast.subgraphs.get('Cluster');
  assert.ok(cluster);
  assert.equal(cluster.nodeIds.length, 3);
  assert.equal(ast.styles.length, 2);

  // Delete Auth and Worker
  deleteNodes(ast, ['Auth', 'Worker']);

  // Subgraph should now only contain API
  assert.deepEqual(cluster.nodeIds, ['API']);

  // Style declarations for Auth and Worker must be removed
  assert.equal(ast.styles.some((s) => s.targetId === 'Auth'), false);
  assert.equal(ast.styles.some((s) => s.targetId === 'Worker'), false);

  // Serialization sanity check
  const serialized = serializeMermaidFlowchart(ast);
  assert.ok(!serialized.includes('Auth'));
  assert.ok(!serialized.includes('Worker'));
  assert.ok(serialized.includes('API["API Gateway"]'));
});

test('Multi-Select Batch Mutations: updateNodesShape updates multiple nodes at once', () => {
  const code = `flowchart TD
  A[Node A] --> B[Node B]
  B --> C[Node C]
  C --> D[Node D]`;

  const ast = parseMermaidFlowchart(code);

  // Batch change A, B, and C to circle
  const morphedCount = updateNodesShape(ast, ['A', 'B', 'C'], 'circle');
  assert.equal(morphedCount, 3);

  assert.equal(ast.nodes.get('A')?.shape, 'circle');
  assert.equal(ast.nodes.get('B')?.shape, 'circle');
  assert.equal(ast.nodes.get('C')?.shape, 'circle');
  assert.equal(ast.nodes.get('D')?.shape, 'rectangle'); // D remains unchanged

  const serialized = serializeMermaidFlowchart(ast);
  assert.ok(serialized.includes('A(("Node A"))'));
  assert.ok(serialized.includes('B(("Node B"))'));
  assert.ok(serialized.includes('C(("Node C"))'));
  assert.ok(serialized.includes('D["Node D"]'));
});

test('Multi-Select Batch Mutations: updateNodesStyle and clearNodesStyle', () => {
  const code = `flowchart TD
  Step1[Step 1] --> Step2[Step 2]
  Step2 --> Step3[Step 3]`;

  const ast = parseMermaidFlowchart(code);

  // Apply visual theme to Step1 and Step3
  updateNodesStyle(ast, ['Step1', 'Step3'], {
    fill: '#7c3aed',
    stroke: '#5b21b6',
    color: '#ffffff',
  });

  assert.equal(getNodeStyle(ast, 'Step1')?.fill, '#7c3aed');
  assert.equal(getNodeStyle(ast, 'Step3')?.fill, '#7c3aed');
  assert.equal(getNodeStyle(ast, 'Step2'), undefined);

  let serialized = serializeMermaidFlowchart(ast);
  assert.ok(serialized.includes('style Step1 fill:#7c3aed,stroke:#5b21b6,color:#ffffff'));
  assert.ok(serialized.includes('style Step3 fill:#7c3aed,stroke:#5b21b6,color:#ffffff'));

  // Clear style for Step1
  clearNodesStyle(ast, ['Step1']);
  assert.equal(getNodeStyle(ast, 'Step1'), undefined);
  assert.equal(getNodeStyle(ast, 'Step3')?.fill, '#7c3aed');

  serialized = serializeMermaidFlowchart(ast);
  assert.ok(!serialized.includes('style Step1'));
  assert.ok(serialized.includes('style Step3'));
});

test('Multi-Select Marquee Geometry: Box Intersection Logic', () => {
  // Test marquee overlap formula:
  // !(rect.x + rect.width < minX || rect.x > maxX || rect.y + rect.height < minY || rect.y > maxY)
  const isIntersecting = (
    rect: { x: number; y: number; width: number; height: number },
    marquee: { minX: number; maxX: number; minY: number; maxY: number }
  ) => {
    return !(
      rect.x + rect.width < marquee.minX ||
      rect.x > marquee.maxX ||
      rect.y + rect.height < marquee.minY ||
      rect.y > marquee.maxY
    );
  };

  const nodeA = { x: 50, y: 50, width: 100, height: 60 };
  const nodeB = { x: 200, y: 50, width: 100, height: 60 };
  const nodeC = { x: 125, y: 200, width: 100, height: 60 };

  // 1. Marquee enclosing Node A only
  const marquee1 = { minX: 40, maxX: 160, minY: 40, maxY: 120 };
  assert.equal(isIntersecting(nodeA, marquee1), true);
  assert.equal(isIntersecting(nodeB, marquee1), false);
  assert.equal(isIntersecting(nodeC, marquee1), false);

  // 2. Marquee enclosing Node A and Node B
  const marquee2 = { minX: 40, maxX: 320, minY: 40, maxY: 120 };
  assert.equal(isIntersecting(nodeA, marquee2), true);
  assert.equal(isIntersecting(nodeB, marquee2), true);
  assert.equal(isIntersecting(nodeC, marquee2), false);

  // 3. Large marquee enclosing all three nodes
  const marquee3 = { minX: 0, maxX: 400, minY: 0, maxY: 300 };
  assert.equal(isIntersecting(nodeA, marquee3), true);
  assert.equal(isIntersecting(nodeB, marquee3), true);
  assert.equal(isIntersecting(nodeC, marquee3), true);

  // 4. Marquee that only touches the edge of Node C
  const marquee4 = { minX: 130, maxX: 140, minY: 190, maxY: 210 };
  assert.equal(isIntersecting(nodeA, marquee4), false);
  assert.equal(isIntersecting(nodeB, marquee4), false);
  assert.equal(isIntersecting(nodeC, marquee4), true);

  // 5. Empty space drag (no nodes hit)
  const marquee5 = { minX: 0, maxX: 30, minY: 0, maxY: 30 };
  assert.equal(isIntersecting(nodeA, marquee5), false);
  assert.equal(isIntersecting(nodeB, marquee5), false);
  assert.equal(isIntersecting(nodeC, marquee5), false);
});

test('Multi-Select Batch Mutations: batch edge mutations (updateEdgesType, updateEdgesStyle, deleteEdges)', () => {
  const code = `flowchart LR
  A --> B
  B --> C
  C --> D`;

  const ast = parseMermaidFlowchart(code);
  assert.equal(ast.edges.length, 3);
  const edge0Id = ast.edges[0].id;
  const edge1Id = ast.edges[1].id;
  const edge2Id = ast.edges[2].id;

  // 1. Batch change edge arrow types
  updateEdgesType(ast, [edge0Id, edge2Id], 'thick');
  assert.equal(ast.edges[0].arrowType, 'thick');
  assert.equal(ast.edges[1].arrowType, 'arrow'); // unchanged
  assert.equal(ast.edges[2].arrowType, 'thick');

  let serialized = serializeMermaidFlowchart(ast);
  assert.ok(serialized.includes('A ==> B'));
  assert.ok(serialized.includes('B --> C'));
  assert.ok(serialized.includes('C ==> D'));

  // 2. Batch change edge styles
  updateEdgesStyle(ast, [edge0Id, edge1Id], { stroke: '#059669', 'stroke-width': '3px' });
  assert.equal(getEdgeStyle(ast, edge0Id)?.stroke, '#059669');
  assert.equal(getEdgeStyle(ast, edge1Id)?.stroke, '#059669');
  assert.equal(getEdgeStyle(ast, edge2Id), undefined);

  serialized = serializeMermaidFlowchart(ast);
  assert.ok(serialized.includes('linkStyle 0 stroke:#059669,stroke-width:3px'));
  assert.ok(serialized.includes('linkStyle 1 stroke:#059669,stroke-width:3px'));

  // 3. Batch clear edge styles
  clearEdgesStyle(ast, [edge0Id]);
  assert.equal(getEdgeStyle(ast, edge0Id), undefined);
  assert.equal(getEdgeStyle(ast, edge1Id)?.stroke, '#059669');

  // 4. Batch delete edges
  const deletedEdges = deleteEdges(ast, [edge1Id, edge2Id]);
  assert.equal(deletedEdges, 2);
  assert.equal(ast.edges.length, 1);
  assert.equal(ast.edges[0].id, edge0Id);
});

test('Multi-Select Batch Mutations: simultaneous node and edge styling & deletion', () => {
  const code = `flowchart TD
  Start[Start Node] --> Action1[Action 1]
  Action1 --> Action2[Action 2]
  Action2 --> Finish[Finish Node]`;

  const ast = parseMermaidFlowchart(code);
  const targetNodes = ['Start', 'Action1'];
  const targetEdgeIds = [ast.edges[0].id]; // Start --> Action1

  // 1. Simultaneously style selected nodes and selected arrows
  const presetTheme = {
    fill: '#ede9fe',
    stroke: '#7c3aed',
    color: '#5b21b6',
  };
  updateNodesStyle(ast, targetNodes, presetTheme);
  updateEdgesStyle(ast, targetEdgeIds, { stroke: presetTheme.stroke, 'stroke-width': '2px' });

  assert.equal(getNodeStyle(ast, 'Start')?.fill, '#ede9fe');
  assert.equal(getNodeStyle(ast, 'Action1')?.fill, '#ede9fe');
  assert.equal(getNodeStyle(ast, 'Action2'), undefined);
  assert.equal(getEdgeStyle(ast, targetEdgeIds[0])?.stroke, '#7c3aed');

  let serialized = serializeMermaidFlowchart(ast);
  assert.ok(serialized.includes('style Start fill:#ede9fe,stroke:#7c3aed,color:#5b21b6'));
  assert.ok(serialized.includes('style Action1 fill:#ede9fe,stroke:#7c3aed,color:#5b21b6'));
  assert.ok(serialized.includes('linkStyle 0 stroke:#7c3aed,stroke-width:2px'));

  // 2. Simultaneously clear styles
  clearNodesStyle(ast, targetNodes);
  clearEdgesStyle(ast, targetEdgeIds);
  assert.equal(getNodeStyle(ast, 'Start'), undefined);
  assert.equal(getEdgeStyle(ast, targetEdgeIds[0]), undefined);

  // 3. Simultaneously delete selected nodes and selected edges
  // E.g. select Action2 (node) and the Action1-->Action2 edge (which is redundant since deleting Action2 cascades it)
  // PLUS select the Action2-->Finish edge and Finish node
  deleteNodes(ast, ['Action2']);
  deleteEdges(ast, [ast.edges[0].id]); // delete remaining Start-->Action1 edge

  assert.equal(ast.nodes.has('Action2'), false);
  assert.equal(ast.nodes.has('Start'), true);
  assert.equal(ast.nodes.has('Finish'), true);
  assert.equal(ast.edges.length, 0); // all edges gone
});
