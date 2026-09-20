import test from 'node:test';
import assert from 'node:assert';
import { getDriver } from '../src/diagrams/registry';
import { SequenceDiagramDriver } from '../src/diagrams/sequence/sequenceDriver';

const driver = SequenceDiagramDriver;

test('Sequence Mutations: addParticipant and addChildParticipant sprouting', () => {
  const ast = driver.parse('sequenceDiagram\n    participant Alice\n');
  assert.strictEqual(ast.participants.size, 1);

  // Add participant
  const p2 = driver.mutations.addNode(ast, 'Bob');
  assert.ok(ast.participants.has(p2));
  assert.strictEqual(ast.participants.get(p2)!.label, 'Bob');
  assert.strictEqual(ast.participants.size, 2);

  // Sprout next participant from Bob
  const p3 = driver.mutations.addChildNode(ast, p2, 'Charlie');
  assert.ok(ast.participants.has(p3));
  assert.strictEqual(ast.participants.get(p3)!.label, 'Charlie');
  assert.strictEqual(ast.participants.size, 3);
  assert.ok(ast.messages.some((m) => m.from === p2 && m.to === p3));

  // Round-trip verification
  const code = driver.serialize(ast);
  assert.ok(code.includes('Bob'));
  assert.ok(code.includes('Charlie'));
  const reparsed = driver.parse(code);
  assert.strictEqual(reparsed.participants.size, 3);
});

test('Sequence Mutations: connect and deleteMessage', () => {
  const ast = driver.parse('sequenceDiagram\n    participant Alice\n    participant Bob\n');
  assert.strictEqual(ast.messages.length, 0);

  // Connect Alice to Bob
  driver.mutations.connect(ast, 'Alice', 'Bob');
  assert.strictEqual(ast.messages.length, 1);
  const msg = ast.messages[0];
  assert.strictEqual(msg.from, 'Alice');
  assert.strictEqual(msg.to, 'Bob');
  assert.strictEqual(ast.timeline.length, 1);

  // Delete message
  driver.mutations.deleteEdge(ast, msg.id);
  assert.strictEqual(ast.messages.length, 0);
  assert.strictEqual(ast.timeline.length, 0);
});

test('Sequence Mutations: deleteParticipant cascades messages and box references', () => {
  const code = `sequenceDiagram
    box Core
        participant Alice
        participant Bob
    end
    participant Charlie
    Alice->>Bob: Hello
    Bob->>Charlie: Forward
`;
  const ast = driver.parse(code);
  assert.strictEqual(ast.participants.size, 3);
  assert.strictEqual(ast.messages.length, 2);

  // Delete Bob
  driver.mutations.deleteNode(ast, 'Bob');

  assert.strictEqual(ast.participants.size, 2);
  assert.ok(!ast.participants.has('Bob'));
  // All messages involving Bob should be deleted
  assert.strictEqual(ast.messages.length, 0);
  assert.strictEqual(ast.timeline.length, 0);

  // Bob should be removed from box
  const box = ast.boxes.get('box_1')!;
  assert.ok(!box.participantIds.includes('Bob'));
  assert.ok(box.participantIds.includes('Alice'));
});

test('Sequence Mutations: batch deleteParticipants cascades incident messages', () => {
  const code = `sequenceDiagram
    participant A
    participant B
    participant C
    A->>B: 1
    B->>C: 2
    C->>A: 3
`;
  const ast = driver.parse(code);
  assert.strictEqual(ast.participants.size, 3);
  assert.strictEqual(ast.messages.length, 3);

  driver.mutations.deleteNodes(ast, ['A', 'B']);
  assert.strictEqual(ast.participants.size, 1);
  assert.ok(ast.participants.has('C'));
  assert.strictEqual(ast.messages.length, 0);
});

test('Sequence Mutations: updateParticipantLabel and updateNodeKind morphing', () => {
  const ast = driver.parse('sequenceDiagram\n    participant Alice\n');
  assert.strictEqual(ast.participants.get('Alice')!.kind, 'participant');

  // Update label
  driver.mutations.updateNodeLabel(ast, 'Alice', 'Super Alice');
  assert.strictEqual(ast.participants.get('Alice')!.label, 'Super Alice');

  // Morph to actor
  driver.mutations.updateNodeKind(ast, 'Alice', 'actor');
  assert.strictEqual(ast.participants.get('Alice')!.kind, 'actor');

  // View projection reflects kind and shape
  const proj = driver.project(ast);
  assert.strictEqual(proj.nodes.get('Alice')!.shape, 'circle');
  assert.strictEqual(proj.nodes.get('Alice')!.kind, 'actor');

  // Morph back to participant
  driver.mutations.updateNodeKind(ast, 'Alice', 'participant');
  const proj2 = driver.project(ast);
  assert.strictEqual(proj2.nodes.get('Alice')!.shape, 'rectangle');
});

test('Sequence Mutations: reverseEdge swaps from and to', () => {
  const ast = driver.parse('sequenceDiagram\n    Alice->>Bob: Hello\n');
  const edgeId = ast.messages[0].id;

  const reversed = driver.mutations.reverseEdge(ast, edgeId);
  assert.strictEqual(reversed, edgeId);
  assert.strictEqual(ast.messages[0].from, 'Bob');
  assert.strictEqual(ast.messages[0].to, 'Alice');
  assert.strictEqual(ast.messages[0].label, 'Hello');

  const serialized = driver.serialize(ast);
  assert.ok(serialized.includes('Bob->>Alice: Hello'));
});

test('Sequence Mutations: insertNodeOnEdge splits message with intermediate participant', () => {
  const ast = driver.parse('sequenceDiagram\n    Alice->>Bob: Original Message\n');
  const edgeId = ast.messages[0].id;

  const midId = driver.mutations.insertNodeOnEdge(ast, edgeId, 'Proxy');
  assert.ok(midId);
  assert.strictEqual(ast.participants.size, 3);
  assert.strictEqual(ast.messages.length, 2);

  // First message: Alice -> Proxy
  assert.strictEqual(ast.messages[0].from, 'Alice');
  assert.strictEqual(ast.messages[0].to, midId);
  assert.strictEqual(ast.messages[0].label, 'Original Message');

  // Second message: Proxy -> Bob
  assert.strictEqual(ast.messages[1].from, midId);
  assert.strictEqual(ast.messages[1].to, 'Bob');

  // Timeline ordering: message 1 then message 2
  assert.strictEqual(ast.timeline.length, 2);
  assert.strictEqual((ast.timeline[0] as any).message.to, midId);
  assert.strictEqual((ast.timeline[1] as any).message.from, midId);
});

test('Sequence Mutations: updateEdgeType changes message arrow', () => {
  const ast = driver.parse('sequenceDiagram\n    Alice->>Bob: Hello\n');
  const edgeId = ast.messages[0].id;

  driver.mutations.updateEdgeType!(ast, edgeId, 'dotted');
  assert.strictEqual(ast.messages[0].arrow, 'dotted_arrow');
  let code = driver.serialize(ast);
  assert.ok(code.includes('Alice-->>Bob'));

  driver.mutations.updateEdgeType!(ast, edgeId, 'cross');
  assert.strictEqual(ast.messages[0].arrow, 'solid_cross');
  code = driver.serialize(ast);
  assert.ok(code.includes('Alice-xBob'));

  driver.mutations.updateEdgeType!(ast, edgeId, 'open');
  assert.strictEqual(ast.messages[0].arrow, 'solid_open');
  code = driver.serialize(ast);
  assert.ok(code.includes('Alice->Bob'));
});

test('Sequence Mutations: duplicateNodes duplicates participants and internal messages', () => {
  const code = `sequenceDiagram
    participant Alice
    participant Bob
    participant Outside
    Alice->>Bob: Internal
    Alice->>Outside: External
`;
  const ast = driver.parse(code);
  assert.strictEqual(ast.participants.size, 3);
  assert.strictEqual(ast.messages.length, 2);

  const res = driver.mutations.duplicateNodes(ast, ['Alice', 'Bob']);
  assert.strictEqual(res.nodeIds.length, 2);
  assert.strictEqual(res.edgeIds.length, 1);
  assert.strictEqual(ast.participants.size, 5);
  assert.strictEqual(ast.messages.length, 3);

  const newAlice = res.nodeIds[0];
  const newBob = res.nodeIds[1];
  const dupMsg = ast.messages.find((m) => m.id === res.edgeIds[0])!;
  assert.strictEqual(dupMsg.from, newAlice);
  assert.strictEqual(dupMsg.to, newBob);
  assert.strictEqual(dupMsg.label, 'Internal');
});

test('Sequence Mutations: Box grouping operations', () => {
  const ast = driver.parse('sequenceDiagram\n    participant Alice\n    participant Bob\n');

  // Create box
  const boxId = driver.mutations.createGroupWithMembers(ast, 'Backend', ['Alice', 'Bob']);
  assert.ok(ast.boxes.has(boxId));
  assert.strictEqual(ast.boxes.get(boxId)!.label, 'Backend');
  assert.strictEqual(ast.participants.get('Alice')!.boxId, boxId);
  assert.strictEqual(ast.participants.get('Bob')!.boxId, boxId);

  // Rename box
  driver.mutations.renameGroup(ast, boxId, 'Core Services');
  assert.strictEqual(ast.boxes.get(boxId)!.label, 'Core Services');

  // Move Alice out of box
  driver.mutations.moveNodeToGroup(ast, 'Alice', null);
  assert.strictEqual(ast.participants.get('Alice')!.boxId, undefined);
  assert.ok(!ast.boxes.get(boxId)!.participantIds.includes('Alice'));
  assert.ok(ast.boxes.get(boxId)!.participantIds.includes('Bob'));

  // Delete box without deleting members
  driver.mutations.deleteGroup(ast, boxId, false);
  assert.ok(!ast.boxes.has(boxId));
  assert.ok(ast.participants.has('Bob'));
  assert.strictEqual(ast.participants.get('Bob')!.boxId, undefined);

  // Create another box and delete with members
  const box2 = driver.mutations.createGroupWithMembers(ast, 'Temp Box', ['Bob']);
  driver.mutations.deleteGroup(ast, box2, true);
  assert.ok(!ast.boxes.has(box2));
  assert.ok(!ast.participants.has('Bob'));
});

test('Sequence Mutations: Participant and box styling', () => {
  const ast = driver.parse('sequenceDiagram\n    participant Alice\n');
  driver.mutations.updateNodeStyle(ast, 'Alice', { fill: '#ff0000', color: '#ffffff' });
  const style = driver.mutations.getNodeStyle(ast, 'Alice');
  assert.deepEqual(style, { fill: '#ff0000', color: '#ffffff' });

  driver.mutations.clearNodeStyle(ast, 'Alice');
  assert.strictEqual(driver.mutations.getNodeStyle(ast, 'Alice'), undefined);

  const boxId = driver.mutations.createGroup(ast, 'Styled Box');
  driver.mutations.updateGroupStyle(ast, boxId, { color: 'Aqua' });
  assert.deepEqual(driver.mutations.getGroupStyle(ast, boxId), { color: 'Aqua' });

  driver.mutations.clearGroupStyle(ast, boxId);
  assert.strictEqual(driver.mutations.getGroupStyle(ast, boxId), undefined);
});
