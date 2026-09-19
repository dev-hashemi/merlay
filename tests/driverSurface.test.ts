import test from 'node:test';
import assert from 'node:assert';
import { getDriver } from '../src/diagrams/registry';
import { DiagramDriver } from '../src/diagrams/types';

const flowchartDriver = getDriver('flowchart')!;
const stateDriver = getDriver('stateDiagram')!;
const sequenceDriver = getDriver('sequenceDiagram')!;
const mindmapDriver = getDriver('mindmap')!;

function roundTrip(driver: DiagramDriver, code: string) {
  const ast = driver.parse(code);
  return { ast, code: driver.serialize(ast) };
}

test('Driver surface: flowchart capabilities, labels, and projection', () => {
  assert.deepEqual(flowchartDriver.capabilities, {
    supportsDirection: true,
    supportsNodeKinds: true,
    supportsEdgeTypes: true,
    supportsEdgeStyles: true,
    supportsGroups: true,
    hasAnchors: false,
    supportsDefaultStyles: true,
  });
  assert.strictEqual(flowchartDriver.labels.node, 'Step');
  assert.strictEqual(flowchartDriver.mutations.anchors, undefined);
  assert.ok(flowchartDriver.nodeKindOptions.length > 0);

  const { ast, code } = roundTrip(
    flowchartDriver,
    'flowchart TD\n    A[Start] --> B{Choice}\n'
  );
  const projection = flowchartDriver.project(ast);
  assert.strictEqual(projection.nodes.size, 2);
  assert.strictEqual(projection.edges.length, 1);
  assert.strictEqual(projection.direction, 'TD');
  assert.ok(code.includes('flowchart TD'));
});

test('Driver surface: state capabilities, labels, and projection', () => {
  assert.deepEqual(stateDriver.capabilities, {
    supportsDirection: true,
    supportsNodeKinds: true,
    supportsEdgeTypes: false,
    supportsEdgeStyles: false,
    supportsGroups: true,
    hasAnchors: true,
    supportsDefaultStyles: true,
  });
  assert.strictEqual(stateDriver.labels.node, 'State');
  assert.strictEqual(stateDriver.mutations.updateEdgeType, undefined);

  const { ast } = roundTrip(
    stateDriver,
    'stateDiagram-v2\n    direction LR\n    [*] --> Idle\n    Idle --> Done : finish\n    Done --> [*]\n'
  );
  const projection = stateDriver.project(ast);
  assert.strictEqual(projection.nodes.size, 3); // [*], Idle, Done
  assert.strictEqual(projection.edges.length, 3);
  assert.strictEqual(projection.direction, 'LR');
  // [*] anchors project as circles; their start/end kind is resolved by the
  // DOM adapter, not the projection
  const anchor = projection.nodes.get('[*]')!;
  assert.strictEqual(anchor.shape, 'circle');
  // transitions carry their label through the projection
  const labeled = projection.edges.find((e) => e.label === 'finish');
  assert.ok(labeled);
});

test('Driver surface: state mutations work through the unified interface', () => {
  const driver = stateDriver;
  const ast = driver.parse('stateDiagram-v2\n    [*] --> Idle\n');

  const childId = driver.mutations.addChildNode(ast, 'Idle', 'Next State');
  assert.ok(ast.states.has(childId));
  assert.ok(ast.transitions.some((t) => t.from === 'Idle' && t.to === childId));

  const code = driver.serialize(ast);
  assert.ok(code.includes('Idle -->'));
  // round-trip the mutated code
  const reparsed = driver.parse(code);
  assert.strictEqual(reparsed.states.size, ast.states.size);
});

test('Driver surface: flowchart mutations work through the unified interface', () => {
  const driver = flowchartDriver;
  const ast = driver.parse('flowchart TD\n    A --> B\n');

  const nodeId = driver.mutations.addNode(ast, 'New Step');
  assert.ok(ast.nodes.has(nodeId));
  driver.mutations.updateNodeKind(ast, nodeId, 'diamond');
  assert.strictEqual(ast.nodes.get(nodeId)!.shape, 'diamond');

  const childId = driver.mutations.addChildNode(ast, 'B', 'Next Step');
  assert.ok(ast.edges.some((e) => e.from === 'B' && e.to === childId));

  const edgeId = ast.edges[0].id;
  const insertedId = driver.mutations.insertNodeOnEdge(ast, edgeId, 'Mid');
  assert.ok(insertedId);
  assert.strictEqual(ast.edges.length, 3); // split into two

  const reversedId = driver.mutations.reverseEdge(ast, ast.edges[0].id);
  assert.ok(reversedId);
});

test('Driver surface: anchors API for state diagrams', () => {
  const driver = stateDriver;
  const ast = driver.parse('stateDiagram-v2\n    [*] --> Idle\n');
  const anchors = driver.mutations.anchors!;
  assert.ok(anchors);
  assert.ok(anchors.isAnchor('[*]'));
  assert.ok(!anchors.isAnchor('Idle'));
  assert.ok(anchors.has(ast, 'start'));
  assert.ok(!anchors.has(ast, 'end'));

  const endStateId = anchors.add(ast, 'end');
  assert.ok(endStateId);
  assert.ok(anchors.has(ast, 'end'));

  anchors.delete(ast, 'start');
  assert.ok(!anchors.has(ast, 'start'));
});

test('Driver surface: sequence capabilities, labels, and projection', () => {
  assert.deepEqual(sequenceDriver.capabilities, {
    supportsDirection: false,
    supportsNodeKinds: true,
    supportsEdgeTypes: true,
    supportsEdgeStyles: false,
    supportsGroups: true,
    hasAnchors: false,
  });
  assert.strictEqual(sequenceDriver.labels.node, 'Participant');
  assert.strictEqual(sequenceDriver.labels.edge, 'Message');
  assert.strictEqual(sequenceDriver.mutations.anchors, undefined);
  assert.ok(sequenceDriver.nodeKindOptions.length > 0);
  assert.ok(sequenceDriver.canvasHint);

  const { ast, code } = roundTrip(
    sequenceDriver,
    'sequenceDiagram\n    actor Alice\n    participant Bob\n    Alice->>Bob: Hello\n'
  );
  const projection = sequenceDriver.project(ast);
  assert.strictEqual(projection.nodes.size, 2);
  assert.strictEqual(projection.edges.length, 1);
  assert.strictEqual(projection.direction, undefined);
  assert.strictEqual(projection.nodes.get('Alice')!.shape, 'circle');
  assert.strictEqual(projection.nodes.get('Bob')!.shape, 'rectangle');
  assert.strictEqual(projection.edges[0].label, 'Hello');
  assert.ok(code.includes('sequenceDiagram'));
});

test('Driver surface: sequence mutations work through the unified interface', () => {
  const driver = sequenceDriver;
  const ast = driver.parse('sequenceDiagram\n    Alice->>Bob: Hello\n');

  const childId = driver.mutations.addChildNode(ast, 'Bob', 'Next Participant');
  assert.ok(ast.participants.has(childId));
  assert.ok(ast.messages.some((m: any) => m.from === 'Bob' && m.to === childId));

  const code = driver.serialize(ast);
  assert.ok(code.includes('Bob->>'));
  const reparsed = driver.parse(code);
  assert.strictEqual(reparsed.participants.size, ast.participants.size);
});

test('Driver surface: mindmap capabilities, labels, and projection', () => {
  assert.deepEqual(mindmapDriver.capabilities, {
    supportsDirection: false,
    supportsNodeKinds: true,
    supportsEdgeTypes: false,
    supportsEdgeStyles: false,
    supportsGroups: false,
    hasAnchors: false,
    supportsNodeStyles: false,
  });
  assert.strictEqual(mindmapDriver.labels.node, 'Topic');
  assert.strictEqual(mindmapDriver.labels.edge, 'Branch');
  assert.strictEqual(mindmapDriver.mutations.anchors, undefined);
  assert.ok(mindmapDriver.nodeKindOptions.length > 0);
  assert.ok(mindmapDriver.canvasHint);

  const { ast, code } = roundTrip(
    mindmapDriver,
    'mindmap\n  root((Central Topic))\n    Idea 1\n      Detail A\n    Idea 2\n'
  );
  const projection = mindmapDriver.project(ast);
  assert.strictEqual(projection.nodes.size, 4);
  assert.strictEqual(projection.edges.length, 3);
  assert.strictEqual(projection.direction, undefined);
  assert.strictEqual(projection.nodes.get('root')!.shape, 'circle');
  assert.ok(code.includes('mindmap'));
});

test('Driver surface: mindmap mutations work through the unified interface', () => {
  const driver = mindmapDriver;
  const ast = driver.parse('mindmap\n  root((Root))\n    Idea 1\n');

  const childId = driver.mutations.addChildNode(ast, 'root', 'Idea 2');
  assert.ok(ast.nodes.has(childId));

  const code = driver.serialize(ast);
  assert.ok(code.includes('Idea 2'));
  const reparsed = driver.parse(code);
  assert.strictEqual(reparsed.nodes.size, ast.nodes.size);
});

test('Driver surface: clone never aliases committed AST state', () => {
  for (const driver of [flowchartDriver, stateDriver, sequenceDriver, mindmapDriver]) {
    const ast = driver.parse(driver.createDefault('TD'));
    const cloned = driver.clone(ast);
    assert.notEqual(cloned, ast);
    driver.mutations.addNode(cloned, 'Clone Probe');
    const serializedOriginal = driver.serialize(ast);
    assert.ok(!serializedOriginal.includes('Clone Probe'));
  }
});

test('Driver surface: groups through the unified interface', () => {
  const fcAst = flowchartDriver.parse('flowchart TD\n    A --> B\n');
  const fcGroupId = flowchartDriver.mutations.createGroupWithMembers(
    fcAst,
    'New Group',
    ['A', 'B']
  );
  assert.ok(fcAst.subgraphs.has(fcGroupId));
  assert.strictEqual(fcAst.nodes.get('A')!.subgraphId, fcGroupId);

  const stAst = stateDriver.parse('stateDiagram-v2\n    [*] --> Idle\n');
  const stGroupId = stateDriver.mutations.createGroup(stAst, 'Composite');
  assert.ok(stAst.compositeStates.has(stGroupId));
  assert.ok(stAst.compositeStates.get(stGroupId)!.stateIds.length > 0);

  const seqAst = sequenceDriver.parse('sequenceDiagram\n    Alice->>Bob: Hello\n');
  const seqGroupId = sequenceDriver.mutations.createGroupWithMembers(
    seqAst,
    'Service Box',
    ['Alice', 'Bob']
  );
  assert.ok(seqAst.boxes.has(seqGroupId));
  assert.strictEqual(seqAst.participants.get('Alice')!.boxId, seqGroupId);
});
