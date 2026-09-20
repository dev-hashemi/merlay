import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMermaidFlowchart } from '../src/diagrams/flowchart/parser';
import { serializeMermaidFlowchart } from '../src/diagrams/flowchart/serializer';
import {
  addNode,
  addChildNode,
  connectNodes,
  deleteNode,
  deleteEdge,
  updateNodeLabel,
  updateNodeShape,
  updateEdgeLabel,
  updateEdgeType,
  reverseEdgeDirection,
  insertNodeOnEdge,
  setDiagramDirection,
} from '../src/diagrams/flowchart/mutations';

test('User Workflow: Sprouting child nodes in succession with unique IDs', () => {
  const initial = `flowchart TD\n    Root[Root Idea]\n`;
  const ast = parseMermaidFlowchart(initial);

  // Sprout 3 children sequentially
  const child1 = addChildNode(ast, 'Root', 'Step 1', 'rounded');
  const child2 = addChildNode(ast, 'Root', 'Step 2', 'diamond');
  const child3 = addChildNode(ast, child1.nodeId, 'Sub Step 1.1', 'circle');

  assert.equal(ast.nodes.size, 4);
  assert.equal(ast.edges.length, 3);
  assert.notEqual(child1.nodeId, child2.nodeId);
  assert.notEqual(child1.nodeId, child3.nodeId);

  // Verify edges connected properly
  const rootEdges = ast.edges.filter((e) => e.from === 'Root');
  assert.equal(rootEdges.length, 2);
  assert.ok(rootEdges.some((e) => e.to === child1.nodeId));
  assert.ok(rootEdges.some((e) => e.to === child2.nodeId));

  const child1Edge = ast.edges.find((e) => e.from === child1.nodeId);
  assert.ok(child1Edge);
  assert.equal(child1Edge.to, child3.nodeId);

  // Verify roundtrip serialization
  const serialized = serializeMermaidFlowchart(ast);
  const reparsed = parseMermaidFlowchart(serialized);
  assert.equal(reparsed.nodes.size, 4);
  assert.equal(reparsed.edges.length, 3);
});

test('User Workflow: Sprouting a node inside a Subgraph preserves subgraph hierarchy', () => {
  const initial = `
flowchart TD
    subgraph Cluster1 ["Main Service"]
        A[Controller]
    end
`.trim();

  const ast = parseMermaidFlowchart(initial);
  assert.ok(ast.subgraphs.has('Cluster1'));
  assert.deepEqual(ast.subgraphs.get('Cluster1')!.nodeIds, ['A']);

  // Sprout child from A
  const child = addChildNode(ast, 'A', 'Worker Task', 'rectangle');
  const childNode = ast.nodes.get(child.nodeId)!;

  // Child must inherit parent node's subgraph
  assert.equal(childNode.subgraphId, 'Cluster1');
  assert.ok(ast.subgraphs.get('Cluster1')!.nodeIds.includes(child.nodeId));

  const serialized = serializeMermaidFlowchart(ast);
  const reparsed = parseMermaidFlowchart(serialized);
  assert.ok(reparsed.subgraphs.has('Cluster1'));
  assert.equal(reparsed.subgraphs.get('Cluster1')!.nodeIds.length, 2);
});

test('User Workflow: Multiple parallel arrows between identical nodes with distinct styles and labels', () => {
  const initial = `
flowchart LR
    Client[Client App]
    Server[API Server]
`.trim();

  const ast = parseMermaidFlowchart(initial);

  // User connects Client -> Server (HTTP Request)
  const edge1Id = connectNodes(ast, 'Client', 'Server', 'arrow', 'HTTP Request');
  // User connects Client -> Server again (WebSocket Session)
  const edge2Id = connectNodes(ast, 'Client', 'Server', 'thick', 'WebSocket Session');
  // User connects Server -> Client (Server-Sent Events)
  const edge3Id = connectNodes(ast, 'Server', 'Client', 'dotted', 'SSE Events');

  assert.ok(edge1Id);
  assert.ok(edge2Id);
  assert.ok(edge3Id);
  assert.equal(ast.edges.length, 3);
  assert.notEqual(edge1Id, edge2Id);
  assert.notEqual(edge1Id, edge3Id);

  // Verify serialization contains all 3 distinct edges
  const serialized = serializeMermaidFlowchart(ast);
  assert.match(serialized, /Client -->\|HTTP Request\| Server/);
  assert.match(serialized, /Client ==>\|WebSocket Session\| Server/);
  assert.match(serialized, /Server -\.->\|SSE Events\| Client/);

  const reparsed = parseMermaidFlowchart(serialized);
  assert.equal(reparsed.edges.length, 3);
  const clientToServer = reparsed.edges.filter((e) => e.from === 'Client' && e.to === 'Server');
  assert.equal(clientToServer.length, 2);
});

test('User Workflow: Reversing edge direction retains label, style, and updates connectivity', () => {
  const initial = `
flowchart TD
    Producer -->|Send Payload| Consumer
`.trim();

  const ast = parseMermaidFlowchart(initial);
  const originalEdge = ast.edges[0];
  assert.equal(originalEdge.from, 'Producer');
  assert.equal(originalEdge.to, 'Consumer');
  assert.equal(originalEdge.label, 'Send Payload');

  // User clicks reverse in HUD
  const reversedEdgeId = reverseEdgeDirection(ast, originalEdge.id);
  assert.ok(reversedEdgeId);

  const reversed = ast.edges.find((e) => e.id === reversedEdgeId);
  assert.ok(reversed);
  assert.equal(reversed.from, 'Consumer');
  assert.equal(reversed.to, 'Producer');
  assert.equal(reversed.label, 'Send Payload');
  assert.equal(reversed.arrowType, 'arrow');

  const serialized = serializeMermaidFlowchart(ast);
  assert.match(serialized, /Consumer -->\|Send Payload\| Producer/);

  const reparsed = parseMermaidFlowchart(serialized);
  assert.equal(reparsed.edges[0].from, 'Consumer');
  assert.equal(reparsed.edges[0].to, 'Producer');
});

test('User Workflow: Inserting an intermediate node on an edge splits the flow cleanly', () => {
  const initial = `
flowchart LR
    Frontend -->|Query| Database
`.trim();

  const ast = parseMermaidFlowchart(initial);
  const edgeId = ast.edges[0].id;

  // User drags or inserts an intermediate Cache node between Frontend and Database
  const result = insertNodeOnEdge(ast, edgeId, 'Redis Cache', 'cylinder');
  assert.ok(result);

  const newNode = ast.nodes.get(result.nodeId);
  assert.ok(newNode);
  assert.equal(newNode.label, 'Redis Cache');
  assert.equal(newNode.shape, 'cylinder');
  assert.equal(ast.nodes.size, 3);
  assert.equal(ast.edges.length, 2);

  // Original edge should be removed, replaced by Frontend -> newNode and newNode -> Database
  const edge1 = ast.edges.find((e) => e.id === result.edge1Id)!;
  const edge2 = ast.edges.find((e) => e.id === result.edge2Id)!;

  assert.equal(edge1.from, 'Frontend');
  assert.equal(edge1.to, newNode.id);
  assert.equal(edge1.label, 'Query'); // Original label preserved on first leg

  assert.equal(edge2.from, newNode.id);
  assert.equal(edge2.to, 'Database');

  const serialized = serializeMermaidFlowchart(ast);
  const reparsed = parseMermaidFlowchart(serialized);
  assert.equal(reparsed.nodes.size, 3);
  assert.equal(reparsed.edges.length, 2);
  assert.ok(reparsed.nodes.has(newNode.id));
  assert.equal(reparsed.nodes.get(newNode.id)!.shape, 'cylinder');
});

test('User Workflow: Cascade deletion removes all connected edges without leaving dangling references', () => {
  const initial = `
flowchart TD
    Source1 --> Hub
    Source2 --> Hub
    Hub --> Sink1
    Hub --> Sink2
    Hub --> Sink3
    Isolated[Lonely Node]
`.trim();

  const ast = parseMermaidFlowchart(initial);
  assert.equal(ast.nodes.size, 7);
  assert.equal(ast.edges.length, 5);

  // User deletes the central Hub
  deleteNode(ast, 'Hub');

  // Hub and all its 5 edges must be completely gone
  assert.equal(ast.nodes.size, 6);
  assert.equal(ast.nodes.has('Hub'), false);
  assert.equal(ast.edges.length, 0);

  // Remaining nodes must be intact
  assert.ok(ast.nodes.has('Source1'));
  assert.ok(ast.nodes.has('Source2'));
  assert.ok(ast.nodes.has('Sink1'));
  assert.ok(ast.nodes.has('Sink2'));
  assert.ok(ast.nodes.has('Sink3'));
  assert.ok(ast.nodes.has('Isolated'));

  const serialized = serializeMermaidFlowchart(ast);
  const reparsed = parseMermaidFlowchart(serialized);
  assert.equal(reparsed.nodes.size, 6);
  assert.equal(reparsed.edges.length, 0);
});

test('User Workflow: Diagram direction toggling preserves all nodes, shapes, labels, and connections', () => {
  const initial = `
flowchart TD
    A[Start] --> B{Check}
    B -->|Yes| C[End]
`.trim();

  const ast = parseMermaidFlowchart(initial);
  assert.equal(ast.direction, 'TD');

  // Switch to LR
  setDiagramDirection(ast, 'LR');
  assert.equal(ast.direction, 'LR');
  let serialized = serializeMermaidFlowchart(ast);
  assert.ok(serialized.startsWith('flowchart LR'));

  // Switch to BT
  setDiagramDirection(ast, 'BT');
  assert.equal(ast.direction, 'BT');
  serialized = serializeMermaidFlowchart(ast);
  assert.ok(serialized.startsWith('flowchart BT'));

  // Roundtrip
  const reparsed = parseMermaidFlowchart(serialized);
  assert.equal(reparsed.direction, 'BT');
  assert.equal(reparsed.nodes.size, 3);
  assert.equal(reparsed.edges.length, 2);
});

test('User Workflow: Morphing node shapes across all 10 types maintains label and edges', () => {
  const initial = `
flowchart LR
    Source --> Target[Transform Me]
`.trim();

  const ast = parseMermaidFlowchart(initial);
  const shapes = [
    'rectangle',
    'rounded',
    'stadium',
    'subroutine',
    'cylinder',
    'circle',
    'diamond',
    'hexagon',
    'parallelogram',
  ] as const;

  for (const shape of shapes) {
    updateNodeShape(ast, 'Target', shape);
    assert.equal(ast.nodes.get('Target')!.shape, shape);

    const serialized = serializeMermaidFlowchart(ast);
    const reparsed = parseMermaidFlowchart(serialized);
    assert.equal(reparsed.nodes.get('Target')!.shape, shape);
    assert.equal(reparsed.nodes.get('Target')!.label, 'Transform Me');
    assert.equal(reparsed.edges.length, 1);
  }
});

test('User Workflow: Full end-to-end simulation of a real user editing session', () => {
  // Step 1: Start with blank canvas
  const ast = parseMermaidFlowchart('flowchart TD\nStart["Initial Idea"]');
  assert.equal(ast.nodes.size, 1);

  // Step 2: Add decision diamond
  const decision = addChildNode(ast, 'Start', 'Is Authorized?', 'diamond');
  updateEdgeLabel(ast, decision.edgeId, 'Check');

  // Step 3: Branch Yes and No
  const yesNode = addChildNode(ast, decision.nodeId, 'Process Transaction', 'rectangle');
  const noNode = addChildNode(ast, decision.nodeId, 'Show Error', 'rounded');

  updateEdgeLabel(ast, yesNode.edgeId, 'Yes');
  updateEdgeLabel(ast, noNode.edgeId, 'No');

  // Step 4: Insert Fraud Detection between Check and Yes
  const insertResult = insertNodeOnEdge(ast, yesNode.edgeId, 'Fraud Detection API', 'subroutine');
  assert.ok(insertResult);

  // Step 5: Change arrow type to thick for high-security connection
  updateEdgeType(ast, insertResult.edge2Id, 'thick');
  updateEdgeLabel(ast, insertResult.edge2Id, 'Approved');

  // Step 6: Delete the No branch
  deleteNode(ast, noNode.nodeId);

  // Step 7: Toggle layout direction to LR
  setDiagramDirection(ast, 'LR');

  // Verify final state
  assert.equal(ast.direction, 'LR');
  assert.equal(ast.nodes.size, 4); // Start, decision, Fraud, Process
  assert.equal(ast.edges.length, 3); // Start->decision, decision->Fraud, Fraud->Process
  assert.equal(ast.nodes.has(noNode.nodeId), false);

  const serialized = serializeMermaidFlowchart(ast);
  const reparsed = parseMermaidFlowchart(serialized);

  assert.equal(reparsed.direction, 'LR');
  assert.equal(reparsed.nodes.size, 4);
  assert.equal(reparsed.edges.length, 3);
  assert.ok(reparsed.edges.some((e) => e.arrowType === 'thick' && e.label === 'Approved'));
});
