import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMermaidFlowchart } from '../src/diagrams/flowchart/parser';
import { serializeMermaidFlowchart } from '../src/diagrams/flowchart/serializer';
import {
  connectNodes,
  insertNodeBetween,
} from '../src/diagrams/flowchart/mutations/edgeMutations';
import { deleteSubgraph } from '../src/diagrams/flowchart/mutations/subgraphDeletionMutations';
import { duplicateNodes } from '../src/diagrams/flowchart/mutations/clipboardMutations';

test('Flowchart Regression: Infix-Arrow Labels round-trip and structure (Bug 1)', () => {
  const code = `flowchart LR
    A -- simple text --> B
    B -. dotted note .-> C
    C == thick label ==> D
    D -- open text --- E
    E --- length text ---> F
    F -- "quoted spaces" --> G
`;
  const ast = parseMermaidFlowchart(code);

  const nodeIds = Array.from(ast.nodes.keys()).sort();
  assert.deepEqual(nodeIds, ['A', 'B', 'C', 'D', 'E', 'F', 'G']);
  assert.equal(ast.edges.length, 6);

  assert.equal(ast.edges[0].from, 'A');
  assert.equal(ast.edges[0].to, 'B');
  assert.equal(ast.edges[0].label, 'simple text');
  assert.equal(ast.edges[0].arrowType, 'arrow');

  assert.equal(ast.edges[1].from, 'B');
  assert.equal(ast.edges[1].to, 'C');
  assert.equal(ast.edges[1].label, 'dotted note');
  assert.equal(ast.edges[1].arrowType, 'dotted');

  assert.equal(ast.edges[2].from, 'C');
  assert.equal(ast.edges[2].to, 'D');
  assert.equal(ast.edges[2].label, 'thick label');
  assert.equal(ast.edges[2].arrowType, 'thick');

  assert.equal(ast.edges[3].from, 'D');
  assert.equal(ast.edges[3].to, 'E');
  assert.equal(ast.edges[3].label, 'open text');
  assert.equal(ast.edges[3].arrowType, 'open');

  assert.equal(ast.edges[5].from, 'F');
  assert.equal(ast.edges[5].to, 'G');
  assert.equal(ast.edges[5].label, 'quoted spaces');
});

test('Flowchart Regression: Direction Acronyms as Node IDs (Bug 2)', () => {
  const code = `flowchart LR
    LR["Left to Right Step"] --> TD["Top Down Step"]
    TD --> TB["Top Bottom Step"]
    TB --> RL["Right Left Step"]
    RL --> BT["Bottom Top Step"]
`;
  const ast = parseMermaidFlowchart(code);

  assert.ok(ast.nodes.has('LR'), 'Node LR should be parsed');
  assert.ok(ast.nodes.has('TD'), 'Node TD should be parsed');
  assert.ok(ast.nodes.has('TB'), 'Node TB should be parsed');
  assert.ok(ast.nodes.has('RL'), 'Node RL should be parsed');
  assert.ok(ast.nodes.has('BT'), 'Node BT should be parsed');

  assert.equal(ast.nodes.get('LR')?.label, 'Left to Right Step');
  assert.equal(ast.nodes.get('TD')?.label, 'Top Down Step');
  assert.equal(ast.direction, 'LR');
  assert.equal(ast.edges.length, 4);

  // Also test inside a subgraph with explicit direction statement
  const subCode = `flowchart TD
    subgraph sub1 ["My Subgraph"]
        direction LR
        LR["Inner LR"] --> TD["Inner TD"]
    end
`;
  const subAst = parseMermaidFlowchart(subCode);
  assert.equal(subAst.subgraphs.get('sub1')?.direction, 'LR');
  assert.ok(subAst.nodes.has('LR'));
  assert.ok(subAst.nodes.has('TD'));
  assert.equal(subAst.nodes.get('LR')?.subgraphId, 'sub1');
});

test('Flowchart Regression: Nested Subgraph Deletion Hierarchy (Bug 3)', () => {
  const code = `flowchart TD
    subgraph P ["Parent Group"]
        p1["Parent Node"]
        subgraph C ["Child Group"]
            c1["Child Node"]
        end
    end
`;
  // Test 1: deleteInnerNodes = true deletes all descendants recursively
  const ast1 = parseMermaidFlowchart(code);
  assert.ok(ast1.subgraphs.has('P'));
  assert.ok(ast1.subgraphs.has('C'));
  assert.ok(ast1.nodes.has('p1'));
  assert.ok(ast1.nodes.has('c1'));

  const deleted = deleteSubgraph(ast1, 'P', true);
  assert.ok(deleted);
  assert.ok(!ast1.subgraphs.has('P'), 'Parent subgraph should be deleted');
  assert.ok(!ast1.subgraphs.has('C'), 'Child subgraph should be deleted');
  assert.ok(!ast1.nodes.has('p1'), 'p1 should be deleted');
  assert.ok(!ast1.nodes.has('c1'), 'c1 should be deleted');

  // Test 2: dissolve (deleteInnerNodes = false) reparents inner nodes to parent
  const ast2 = parseMermaidFlowchart(code);
  const dissolved = deleteSubgraph(ast2, 'C', false);
  assert.ok(dissolved);
  assert.ok(!ast2.subgraphs.has('C'), 'Child subgraph should be dissolved');
  assert.ok(ast2.subgraphs.has('P'), 'Parent subgraph should remain');
  assert.ok(ast2.nodes.has('c1'), 'c1 should remain');

  // c1 should be reparented to P
  assert.equal(ast2.nodes.get('c1')?.subgraphId, 'P');
  assert.ok(ast2.subgraphs.get('P')?.nodeIds.includes('c1'));
  assert.ok(!ast2.subgraphs.get('P')?.subgraphIds.includes('C'));
});

test('Flowchart Regression: duplicateNodes preserves shapeParams and explicit styles (Bug 4)', () => {
  const code = `flowchart TD
    A@{ icon: "aws-s3", label: "Storage" }
    style A fill:#ff0000,stroke:#333333
`;
  const ast = parseMermaidFlowchart(code);
  assert.equal(ast.nodes.get('A')?.shapeParams?.icon, 'aws-s3');
  assert.equal(ast.nodes.get('A')?.style?.fill, '#ff0000');

  const { nodeIds } = duplicateNodes(ast, ['A']);
  assert.equal(nodeIds.length, 1);
  const dupId = nodeIds[0];
  const dupNode = ast.nodes.get(dupId)!;

  // Verify shapeParams preserved
  assert.ok(dupNode.shapeParams);
  assert.equal(dupNode.shapeParams.icon, 'aws-s3');

  // Verify ast.styles updated
  const dupStyle = ast.styles.find((s) => s.targetId === dupId);
  assert.ok(dupStyle, 'ast.styles must contain duplicate style entry');
  assert.equal(dupStyle?.styles.fill, '#ff0000');
  assert.equal(dupStyle?.styles.stroke, '#333333');

  // Verify serialized output emits the style for dupId
  const serialized = serializeMermaidFlowchart(ast);
  assert.match(serialized, new RegExp(`style ${dupId} fill:#ff0000,stroke:#333333`));
  assert.match(serialized, new RegExp(`${dupId}@\\{ icon: "aws-s3"`));
});

test('Flowchart Regression: Multi-line labels serialize with <br/> without corruption (Bug 5)', () => {
  const code = `flowchart TD
    A["Start"]
`;
  const ast = parseMermaidFlowchart(code);
  ast.nodes.get('A')!.label = 'Step 1\nStep 2\nStep 3';

  const serialized = serializeMermaidFlowchart(ast);
  assert.ok(
    serialized.includes('Step 1<br/>Step 2<br/>Step 3'),
    `Serialized output should convert \\n to <br/>: ${serialized}`
  );
  assert.ok(!serialized.includes('\nStep 2'), 'Should not contain raw newlines inside node line');

  // Re-parsing serialized text must not produce phantom nodes
  const reparsed = parseMermaidFlowchart(serialized);
  assert.equal(reparsed.nodes.size, 1);
  assert.ok(reparsed.nodes.has('A'));
  assert.equal(reparsed.nodes.get('A')?.label, 'Step 1<br/>Step 2<br/>Step 3');
});

test('Flowchart Regression: insertNodeBetween with subgraph endpoints (Bug 6)', () => {
  const code = `flowchart TD
    subgraph sub1 ["Service"]
        A["Worker"]
    end
    B["External Client"]
`;
  const ast = parseMermaidFlowchart(code);
  connectNodes(ast, 'sub1', 'B');
  assert.equal(ast.edges.length, 1);
  assert.equal(ast.edges[0].from, 'sub1');
  assert.equal(ast.edges[0].to, 'B');

  // Insert node between subgraph and node
  const res = insertNodeBetween(ast, 'sub1', 'B', 'Gateway');
  assert.ok(res, 'insertNodeBetween should succeed with subgraph endpoint');
  assert.equal(ast.nodes.get(res!.nodeId)?.label, 'Gateway');

  // Verify edge connectivity
  const edgeFromSub = ast.edges.find((e) => e.from === 'sub1');
  const edgeToNode = ast.edges.find((e) => e.to === 'B');
  assert.ok(edgeFromSub);
  assert.ok(edgeToNode);
  assert.equal(edgeFromSub?.to, res!.nodeId);
  assert.equal(edgeToNode?.from, res!.nodeId);
});

test('Flowchart Regression: Preceding Subgraph Style applied to subgraph (Bug 7)', () => {
  const code = `flowchart TD
    style sub1 fill:#abcdef,stroke:#123456
    subgraph sub1 ["Service Alpha"]
        A["Node A"]
    end
`;
  const ast = parseMermaidFlowchart(code);
  assert.ok(ast.subgraphs.has('sub1'));
  const sub = ast.subgraphs.get('sub1')!;
  assert.ok(sub.style, 'Subgraph style should be populated');
  assert.equal(sub.style?.fill, '#abcdef');
  assert.equal(sub.style?.stroke, '#123456');
});

test('Flowchart Regression: Quoted pipes in arrow labels (Bug 8)', () => {
  const code = `flowchart LR
    A -->|"Option A | Option B"| B
`;
  const ast = parseMermaidFlowchart(code);
  assert.deepEqual(Array.from(ast.nodes.keys()).sort(), ['A', 'B']);
  assert.equal(ast.edges.length, 1);
  assert.equal(ast.edges[0].label, 'Option A | Option B');

  // Round-trip serialization
  const serialized = serializeMermaidFlowchart(ast);
  assert.match(serialized, /\|"Option A \| Option B"\|/);
  const reparsed = parseMermaidFlowchart(serialized);
  assert.deepEqual(Array.from(reparsed.nodes.keys()).sort(), ['A', 'B']);
  assert.equal(reparsed.edges[0].label, 'Option A | Option B');
});

test('Flowchart Regression: Subgraph IDs with spaces round-trip cleanly (Bug 9)', () => {
  const code = `flowchart TD
    subgraph "Service Alpha" ["Service Alpha"]
        A["Task"]
    end
`;
  const ast = parseMermaidFlowchart(code);
  assert.ok(ast.subgraphs.has('Service Alpha'));
  assert.equal(ast.subgraphs.get('Service Alpha')?.label, 'Service Alpha');

  const serialized = serializeMermaidFlowchart(ast);
  assert.match(serialized, /subgraph "Service Alpha"/);

  const reparsed = parseMermaidFlowchart(serialized);
  assert.ok(reparsed.subgraphs.has('Service Alpha'));
  assert.equal(reparsed.nodes.get('A')?.subgraphId, 'Service Alpha');
});

test('Flowchart Regression: Multi-Node Conjunction & expands cross-product (Bug 10)', () => {
  const code = `flowchart TD
    A & B --> C & D
`;
  const ast = parseMermaidFlowchart(code);

  const nodeIds = Array.from(ast.nodes.keys()).sort();
  assert.deepEqual(nodeIds, ['A', 'B', 'C', 'D']);
  assert.ok(!ast.nodes.has('&'), 'Conjunction & must not become a node');

  assert.equal(ast.edges.length, 4);
  const edgePairs = ast.edges.map((e) => `${e.from}->${e.to}`).sort();
  assert.deepEqual(edgePairs, ['A->C', 'A->D', 'B->C', 'B->D']);
});
