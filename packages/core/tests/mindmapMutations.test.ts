import test from 'node:test';
import assert from 'node:assert';
import { MindmapDriver } from '../src/diagrams/mindmap/mindmapDriver';
import { parseMermaidMindmap } from '../src/diagrams/mindmap/parser';
import { serializeMermaidMindmap } from '../src/diagrams/mindmap/serializer';
import * as mm from '../src/diagrams/mindmap/mutations';

test('Mindmap Mutations: addNode and addChildNode sprout subtopics cleanly', () => {
  const code = `mindmap\n  root((Central Topic))\n`;
  const ast = parseMermaidMindmap(code);

  const topic1Id = MindmapDriver.mutations.addNode(ast, 'Main Topic 1');
  assert.ok(ast.nodes.has(topic1Id));
  assert.strictEqual(ast.nodes.get(topic1Id)?.parentId, 'root');
  assert.ok(ast.root?.children.includes(topic1Id));

  const subtopicId = MindmapDriver.mutations.addChildNode(ast, topic1Id, 'Subtopic A');
  assert.ok(ast.nodes.has(subtopicId));
  assert.strictEqual(ast.nodes.get(subtopicId)?.parentId, topic1Id);
  assert.ok(ast.nodes.get(topic1Id)?.children.includes(subtopicId));

  const serialized = MindmapDriver.serialize(ast);
  assert.ok(serialized.includes('Main Topic 1'));
  assert.ok(serialized.includes('Subtopic A'));
});

test('Mindmap Mutations: deleteNode cascades to descendant subtrees', () => {
  const code = `mindmap
  root((Root))
    Branch 1
      Leaf 1A
      Leaf 1B
        DeepLeaf 1B1
    Branch 2
      Leaf 2A
`;
  const ast = parseMermaidMindmap(code);
  const branch1 = Array.from(ast.nodes.values()).find((n) => n.label === 'Branch 1')!;
  assert.ok(branch1);

  // Deleting Branch 1 should delete Branch 1, Leaf 1A, Leaf 1B, and DeepLeaf 1B1
  MindmapDriver.mutations.deleteNode(ast, branch1.id);

  assert.ok(!ast.nodes.has(branch1.id));
  assert.ok(!Array.from(ast.nodes.values()).some((n) => n.label === 'Leaf 1A'));
  assert.ok(!Array.from(ast.nodes.values()).some((n) => n.label === 'Leaf 1B'));
  assert.ok(!Array.from(ast.nodes.values()).some((n) => n.label === 'DeepLeaf 1B1'));

  // Branch 2 and Leaf 2A must remain untouched
  assert.ok(Array.from(ast.nodes.values()).some((n) => n.label === 'Branch 2'));
  assert.ok(Array.from(ast.nodes.values()).some((n) => n.label === 'Leaf 2A'));
  assert.strictEqual(ast.root?.children.includes(branch1.id), false);
});

test('Mindmap Mutations: deleting sole root resets to clean default root', () => {
  const code = `mindmap\n  root((Root))\n`;
  const ast = parseMermaidMindmap(code);

  MindmapDriver.mutations.deleteNode(ast, 'root');
  assert.ok(ast.root);
  assert.strictEqual(ast.root.label, 'Central Topic');
  assert.strictEqual(ast.nodes.size, 1);
});

test('Mindmap Mutations: updateNodeKind morphs shapes accurately', () => {
  const code = `mindmap\n  root((Root))\n    Topic A\n`;
  const ast = parseMermaidMindmap(code);
  const topic = Array.from(ast.nodes.values()).find((n) => n.label === 'Topic A')!;

  MindmapDriver.mutations.updateNodeKind(ast, topic.id, 'bang');
  assert.strictEqual(ast.nodes.get(topic.id)?.shape, 'bang');

  let serialized = MindmapDriver.serialize(ast);
  assert.ok(serialized.includes('))Topic A(('));

  MindmapDriver.mutations.updateNodeKind(ast, topic.id, 'cloud');
  assert.strictEqual(ast.nodes.get(topic.id)?.shape, 'cloud');

  serialized = MindmapDriver.serialize(ast);
  assert.ok(serialized.includes(')Topic A('));
});

test('Mindmap Mutations: canConnect and reparenting with cycle prevention', () => {
  const code = `mindmap
  root((Root))
    Branch 1
      Leaf 1A
    Branch 2
      Leaf 2A
`;
  const ast = parseMermaidMindmap(code);
  const branch1 = Array.from(ast.nodes.values()).find((n) => n.label === 'Branch 1')!;
  const leaf1A = Array.from(ast.nodes.values()).find((n) => n.label === 'Leaf 1A')!;
  const branch2 = Array.from(ast.nodes.values()).find((n) => n.label === 'Branch 2')!;
  const leaf2A = Array.from(ast.nodes.values()).find((n) => n.label === 'Leaf 2A')!;

  // 1. Legal reparent: move Leaf 1A to become a child of Branch 2
  assert.strictEqual(MindmapDriver.mutations.canConnect!(ast, branch2.id, leaf1A.id), true);

  // 2. Illegal: self connection
  assert.strictEqual(MindmapDriver.mutations.canConnect!(ast, branch1.id, branch1.id), false);

  // 3. Illegal: reparenting root
  assert.strictEqual(MindmapDriver.mutations.canConnect!(ast, branch1.id, 'root'), false);

  // 4. Illegal: cycle (reparenting ancestor Branch 1 under its own descendant Leaf 1A)
  assert.strictEqual(MindmapDriver.mutations.canConnect!(ast, leaf1A.id, branch1.id), false);

  // 5. Illegal: already a child
  assert.strictEqual(MindmapDriver.mutations.canConnect!(ast, branch1.id, leaf1A.id), false);

  // Perform legal reparent:
  MindmapDriver.mutations.connect(ast, branch2.id, leaf1A.id);

  assert.strictEqual(leaf1A.parentId, branch2.id);
  assert.ok(branch2.children.includes(leaf1A.id));
  assert.strictEqual(branch1.children.includes(leaf1A.id), false);

  const serialized = MindmapDriver.serialize(ast);
  const reparsed = parseMermaidMindmap(serialized);
  const reparsedLeaf = Array.from(reparsed.nodes.values()).find((n) => n.label === 'Leaf 1A')!;
  const reparsedBranch2 = Array.from(reparsed.nodes.values()).find((n) => n.label === 'Branch 2')!;
  assert.strictEqual(reparsedLeaf.parentId, reparsedBranch2.id);
});

test('Mindmap Mutations: insertNodeOnEdge inserts intermediate topic', () => {
  const code = `mindmap
  root((Root))
    Child
`;
  const ast = parseMermaidMindmap(code);
  const child = Array.from(ast.nodes.values()).find((n) => n.label === 'Child')!;
  const edgeId = `edge_root_${child.id}`;

  const intermediateId = MindmapDriver.mutations.insertNodeOnEdge(ast, edgeId, 'Intermediate');
  assert.ok(intermediateId);

  const intermediate = ast.nodes.get(intermediateId)!;
  assert.strictEqual(intermediate.label, 'Intermediate');
  assert.strictEqual(intermediate.parentId, 'root');
  assert.deepEqual(intermediate.children, [child.id]);
  assert.strictEqual(child.parentId, intermediateId);
  assert.ok(ast.root?.children.includes(intermediateId));
  assert.strictEqual(ast.root?.children.includes(child.id), false);

  const serialized = MindmapDriver.serialize(ast);
  const reparsed = parseMermaidMindmap(serialized);
  const reparsedChild = Array.from(reparsed.nodes.values()).find((n) => n.label === 'Child')!;
  const reparsedInter = Array.from(reparsed.nodes.values()).find((n) => n.label === 'Intermediate')!;
  assert.strictEqual(reparsedChild.parentId, reparsedInter.id);
  assert.strictEqual(reparsedInter.parentId, 'root');
});

test('Mindmap Mutations: duplicateNodes deep-clones topic and subtrees', () => {
  const code = `mindmap
  root((Root))
    Branch 1
      Sub 1
      Sub 2
`;
  const ast = parseMermaidMindmap(code);
  const branch1 = Array.from(ast.nodes.values()).find((n) => n.label === 'Branch 1')!;

  const result = MindmapDriver.mutations.duplicateNodes(ast, [branch1.id]);
  assert.strictEqual(result.nodeIds.length, 3); // Branch 1 Copy, Sub 1, Sub 2

  const clonedBranchId = result.nodeIds[0];
  const clonedBranch = ast.nodes.get(clonedBranchId)!;
  assert.strictEqual(clonedBranch.label, 'Branch 1 Copy');
  assert.strictEqual(clonedBranch.parentId, 'root');
  assert.strictEqual(clonedBranch.children.length, 2);

  // Branch 1 and its clone are sibling children of root
  assert.deepEqual(ast.root?.children, [branch1.id, clonedBranchId]);

  const serialized = MindmapDriver.serialize(ast);
  assert.ok(serialized.includes('Branch 1 Copy'));
});
