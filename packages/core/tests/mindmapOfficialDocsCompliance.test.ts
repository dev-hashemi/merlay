import test from 'node:test';
import assert from 'node:assert';
import { MindmapDriver } from '../src/diagrams/mindmap/mindmapDriver';
import { parseMermaidMindmap } from '../src/diagrams/mindmap/parser';
import { serializeMermaidMindmap } from '../src/diagrams/mindmap/serializer';

test('Mindmap Official Docs: Basic hierarchy and shapes from Mermaid documentation', () => {
  const code = `mindmap
  root((mindmap))
    Origins
      Long history
      ::icon(fa fa-book)
      Popularisation
        British popular psychology author Tony Buzan
    Research
      On effectiveness<br/>and features
      On Automatic creation
        Uses
          Creative techniques
          Strategic planning
          Argument mapping
    Tools
      Pen and paper
      Mermaid
`;

  const ast = parseMermaidMindmap(code);
  assert.ok(ast.root);
  assert.strictEqual(ast.root.label, 'mindmap');
  assert.strictEqual(ast.root.shape, 'circle');

  // Origins node
  const origins = Array.from(ast.nodes.values()).find((n) => n.label === 'Origins');
  assert.ok(origins);
  assert.strictEqual(origins.parentId, ast.root.id);

  // Long history has icon
  const longHistory = Array.from(ast.nodes.values()).find((n) => n.label === 'Long history');
  assert.ok(longHistory);
  assert.strictEqual(longHistory.icon, 'fa fa-book');

  // Serialized round trip preserves structure and icons
  const serialized = serializeMermaidMindmap(ast);
  assert.ok(serialized.includes('::icon(fa fa-book)'));
  assert.ok(serialized.includes('Origins'));
  assert.ok(serialized.includes('Mermaid'));

  // Reparse verification
  const reparsed = parseMermaidMindmap(serialized);
  assert.strictEqual(reparsed.nodes.size, ast.nodes.size);
});

test('Mindmap Official Docs: All 7 node shapes round-trip preservation', () => {
  const code = `mindmap
  root((Circle Root))
    rect[Square Rect]
    round(Rounded Rect)
    cloud)Cloud Shape(
    bang))Bang Burst((
    hex{{Hexagon Shape}}
    defaultShape
`;

  const ast = parseMermaidMindmap(code);
  assert.strictEqual(ast.root?.shape, 'circle');

  const rect = Array.from(ast.nodes.values()).find((n) => n.label === 'Square Rect');
  assert.strictEqual(rect?.shape, 'rectangle');

  const round = Array.from(ast.nodes.values()).find((n) => n.label === 'Rounded Rect');
  assert.strictEqual(round?.shape, 'rounded');

  const cloud = Array.from(ast.nodes.values()).find((n) => n.label === 'Cloud Shape');
  assert.strictEqual(cloud?.shape, 'cloud');

  const bang = Array.from(ast.nodes.values()).find((n) => n.label === 'Bang Burst');
  assert.strictEqual(bang?.shape, 'bang');

  const hex = Array.from(ast.nodes.values()).find((n) => n.label === 'Hexagon Shape');
  assert.strictEqual(hex?.shape, 'hexagon');

  const def = Array.from(ast.nodes.values()).find((n) => n.label === 'defaultShape');
  assert.strictEqual(def?.shape, 'default');

  const serialized = serializeMermaidMindmap(ast);
  assert.ok(serialized.includes('((Circle Root))'));
  assert.ok(serialized.includes('[Square Rect]'));
  assert.ok(serialized.includes('(Rounded Rect)'));
  assert.ok(serialized.includes(')Cloud Shape('));
  assert.ok(serialized.includes('))Bang Burst(('));
  assert.ok(serialized.includes('{{Hexagon Shape}}'));
  assert.ok(serialized.includes('defaultShape'));
});

test('Mindmap Official Docs: Classes and styling classes attached to nodes', () => {
  const code = `mindmap
  root((Root)):::urgent
    Branch A:::important
    Branch B
      :::urgent
`;

  const ast = parseMermaidMindmap(code);
  assert.strictEqual(ast.root?.className, 'urgent');

  const branchA = Array.from(ast.nodes.values()).find((n) => n.label === 'Branch A');
  assert.strictEqual(branchA?.className, 'important');

  const branchB = Array.from(ast.nodes.values()).find((n) => n.label === 'Branch B');
  assert.strictEqual(branchB?.className, 'urgent');

  const serialized = serializeMermaidMindmap(ast);
  assert.ok(serialized.includes(':::urgent'));
  assert.ok(serialized.includes(':::important'));
});

test('Mindmap Official Docs: Frontmatter, comments, and accTitle directives survive round-trip', () => {
  const code = `---
title: Project Mindmap
---
mindmap
  %% A diagram level comment
  accTitle: Overview Title
  accDescr: Overview Description
  root((Product Roadmap))
    Frontend
    Backend
`;

  const ast = parseMermaidMindmap(code);
  assert.ok(ast.frontmatter?.includes('title: Project Mindmap'));
  assert.ok(ast.rawLines.some((r) => r.raw.includes('comment')));
  assert.ok(ast.rawLines.some((r) => r.raw.includes('accTitle')));
  assert.ok(ast.rawLines.some((r) => r.raw.includes('accDescr')));

  const serialized = serializeMermaidMindmap(ast);
  assert.ok(serialized.startsWith('---\ntitle: Project Mindmap\n---'));
  assert.ok(serialized.includes('%% A diagram level comment'));
  assert.ok(serialized.includes('accTitle: Overview Title'));
  assert.ok(serialized.includes('accDescr: Overview Description'));
  assert.ok(serialized.includes('root((Product Roadmap))'));
});

test('Mindmap Official Docs: Quotes and multi-line breaks in labels', () => {
  const code = `mindmap
  root(("Root with (parens) and [brackets]"))
    child["Child with <br/> multi-line text"]
`;

  const ast = parseMermaidMindmap(code);
  assert.strictEqual(ast.root?.label, 'Root with (parens) and [brackets]');
  const child = Array.from(ast.nodes.values()).find((n) => n.id !== ast.root?.id);
  assert.strictEqual(child?.label, 'Child with <br/> multi-line text');

  const serialized = serializeMermaidMindmap(ast);
  assert.ok(serialized.includes('"Root with (parens) and [brackets]"'));
  assert.ok(serialized.includes('Child with <br/> multi-line text'));

  // If a label contains quotes, it must be escaped and wrapped in quotes
  child!.label = 'Child with "quotes"';
  const serializedWithQuotes = serializeMermaidMindmap(ast);
  assert.ok(serializedWithQuotes.includes('"Child with \\"quotes\\""'));
});

test('Mindmap Official Docs: Projection to Canvas ViewProjection', () => {
  const code = `mindmap
  root((Center))
    A[Topic A]
      A1(Sub A1)
    B[Topic B]
`;

  const ast = MindmapDriver.parse(code);
  const projection = MindmapDriver.project(ast);

  assert.strictEqual(projection.nodes.size, 4);
  assert.strictEqual(projection.edges.length, 3);
  assert.strictEqual(projection.direction, undefined);

  // Check preorder DFS traversal ordering
  const nodeKeys = Array.from(projection.nodes.keys());
  assert.strictEqual(nodeKeys[0], 'root');
  assert.strictEqual(nodeKeys[1], 'A');
  assert.strictEqual(nodeKeys[2], 'A1');
  assert.strictEqual(nodeKeys[3], 'B');

  // Verify DOM resolveNodeId maps preorder index node_(\d+) to the exact node key
  const mockEl0 = { getAttribute: (attr: string) => (attr === 'id' ? 'mermaid-123-node_0' : null) } as any;
  const mockEl2 = { getAttribute: (attr: string) => (attr === 'id' ? 'node_2' : null) } as any;
  const mockEl3 = { getAttribute: (attr: string) => (attr === 'id' ? 'flowchart-node_3' : null) } as any;

  assert.strictEqual(MindmapDriver.dom.resolveNodeId?.(mockEl0, projection.nodes), 'root');
  assert.strictEqual(MindmapDriver.dom.resolveNodeId?.(mockEl2, projection.nodes), 'A1');
  assert.strictEqual(MindmapDriver.dom.resolveNodeId?.(mockEl3, projection.nodes), 'B');
});
