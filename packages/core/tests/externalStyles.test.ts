import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMermaidFlowchart, parseStyleDeclarations } from '../src/diagrams/flowchart/parser';
import { serializeMermaidFlowchart } from '../src/diagrams/flowchart/serializer';
import {
  updateNodeStyle,
  clearNodeStyle,
  getNodeStyle,
  updateNodesStyle,
  clearNodesStyle,
} from '../src/diagrams/flowchart/mutations';

test('parseStyleDeclarations: Handles complex CSS values, commas, rgb/rgba, and semicolons', () => {
  const css1 = 'fill:rgb(255, 128, 0),stroke:rgba(0, 0, 0, 0.5),stroke-width:2px';
  const res1 = parseStyleDeclarations(css1);
  assert.equal(res1.fill, 'rgb(255, 128, 0)');
  assert.equal(res1.stroke, 'rgba(0, 0, 0, 0.5)');
  assert.equal(res1['stroke-width'], '2px');

  const css2 = 'fill:#fef08a; stroke:#ca8a04; stroke-dasharray: 5 5; color:#854d0e;';
  const res2 = parseStyleDeclarations(css2);
  assert.equal(res2.fill, '#fef08a');
  assert.equal(res2.stroke, '#ca8a04');
  assert.equal(res2['stroke-dasharray'], '5 5');
  assert.equal(res2.color, '#854d0e');

  const css3 = 'fill:hsl(210, 50%, 60%) , stroke:#333';
  const res3 = parseStyleDeclarations(css3);
  assert.equal(res3.fill, 'hsl(210, 50%, 60%)');
  assert.equal(res3.stroke, '#333');
});

test('External Styles: classDef + class A,B className statement parsing and resolution', () => {
  const code = `
flowchart TD
    A[Start] --> B[Process] --> C[End]
    classDef highlight fill:#dcfce7,stroke:#16a34a,stroke-width:3px,color:#15803d
    class A,B highlight
`.trim();

  const ast = parseMermaidFlowchart(code);

  // Nodes A and B should have class 'highlight'
  const nodeA = ast.nodes.get('A');
  const nodeB = ast.nodes.get('B');
  const nodeC = ast.nodes.get('C');

  assert.ok(nodeA);
  assert.ok(nodeB);
  assert.ok(nodeC);

  assert.deepEqual(nodeA.classes, ['highlight']);
  assert.deepEqual(nodeB.classes, ['highlight']);
  assert.equal(nodeC.classes, undefined);

  // Effective style for A and B should be resolved from classDef
  const styleA = getNodeStyle(ast, 'A');
  const styleB = getNodeStyle(ast, 'B');
  const styleC = getNodeStyle(ast, 'C');

  assert.ok(styleA);
  assert.equal(styleA.fill, '#dcfce7');
  assert.equal(styleA.stroke, '#16a34a');
  assert.equal(styleA['stroke-width'], '3px');
  assert.equal(styleA.color, '#15803d');

  assert.ok(styleB);
  assert.equal(styleB.fill, '#dcfce7');

  assert.equal(styleC, undefined);

  // Serializer preserves classDef and class assignment
  const serialized = serializeMermaidFlowchart(ast);
  assert.match(serialized, /classDef highlight fill:#dcfce7,stroke:#16a34a,stroke-width:3px,color:#15803d/);
  assert.match(serialized, /class A,B highlight/);
});

test('External Styles: Modifying a class-styled node detaches class and applies explicit style', () => {
  const code = `
flowchart TD
    A[Start] --> B[Process]
    classDef warning fill:#fef3c7,stroke:#d97706
    class A,B warning
`.trim();

  const ast = parseMermaidFlowchart(code);

  // User changes node A to a new Sky theme
  updateNodeStyle(ast, 'A', {
    fill: '#e0f2fe',
    stroke: '#0284c7',
    color: '#0369a1',
  });

  // Node A should now have explicit style and detached class
  assert.equal(ast.nodes.get('A')?.classes, undefined);
  const styleA = getNodeStyle(ast, 'A');
  assert.equal(styleA?.fill, '#e0f2fe');
  assert.equal(styleA?.stroke, '#0284c7');

  // Node B should still have warning class
  assert.deepEqual(ast.nodes.get('B')?.classes, ['warning']);
  const styleB = getNodeStyle(ast, 'B');
  assert.equal(styleB?.fill, '#fef3c7');

  // Serialization: A gets style, B gets class
  const serialized = serializeMermaidFlowchart(ast);
  assert.match(serialized, /style A fill:#e0f2fe,stroke:#0284c7,color:#0369a1/);
  assert.match(serialized, /class B warning/);
  assert.doesNotMatch(serialized, /class A,B warning/);
});

test('External Styles: Clearing a class-styled node resets it completely', () => {
  const code = `
flowchart TD
    A[Start] --> B[Process]
    classDef warning fill:#fef3c7,stroke:#d97706
    class A,B warning
`.trim();

  const ast = parseMermaidFlowchart(code);

  clearNodeStyle(ast, 'A');

  // Node A is completely clear
  assert.equal(ast.nodes.get('A')?.classes, undefined);
  assert.equal(ast.nodes.get('A')?.style, undefined);
  assert.equal(getNodeStyle(ast, 'A'), undefined);

  // Node B is still styled with warning
  assert.deepEqual(ast.nodes.get('B')?.classes, ['warning']);
  assert.equal(getNodeStyle(ast, 'B')?.fill, '#fef3c7');

  const serialized = serializeMermaidFlowchart(ast);
  assert.doesNotMatch(serialized, /style A/);
  assert.match(serialized, /class B warning/);
});

test('External Styles: Inline ::: shorthand syntax on nodes and edges', () => {
  const code = `
flowchart LR
    A:::entryPoint --> B[Main Task]:::accent --> C:::exitPoint
    classDef entryPoint fill:#dbeafe,stroke:#2563eb
    classDef accent fill:#f3e8ff,stroke:#9333ea
    classDef exitPoint fill:#fee2e2,stroke:#dc2626
`.trim();

  const ast = parseMermaidFlowchart(code);

  // Must not create phantom nodes with ID ':::entryPoint' or ':::accent'
  assert.equal(ast.nodes.size, 3);
  assert.ok(ast.nodes.has('A'));
  assert.ok(ast.nodes.has('B'));
  assert.ok(ast.nodes.has('C'));

  assert.deepEqual(ast.nodes.get('A')?.classes, ['entryPoint']);
  assert.deepEqual(ast.nodes.get('B')?.classes, ['accent']);
  assert.deepEqual(ast.nodes.get('C')?.classes, ['exitPoint']);

  // Check styles resolved from classDefs
  assert.equal(getNodeStyle(ast, 'A')?.fill, '#dbeafe');
  assert.equal(getNodeStyle(ast, 'B')?.fill, '#f3e8ff');
  assert.equal(getNodeStyle(ast, 'C')?.fill, '#fee2e2');

  // Change color of B
  updateNodeStyle(ast, 'B', {
    fill: '#ffedd5',
    stroke: '#ea580c',
  });

  assert.equal(getNodeStyle(ast, 'B')?.fill, '#ffedd5');

  const serialized = serializeMermaidFlowchart(ast);
  assert.match(serialized, /style B fill:#ffedd5,stroke:#ea580c/);
  assert.match(serialized, /class A entryPoint/);
  assert.match(serialized, /class C exitPoint/);
});

test('External Styles: Multi-target style statement e.g. style A,B,C fill:...', () => {
  const code = `
flowchart TD
    A[Step 1]
    B[Step 2]
    C[Step 3]
    style A,B,C fill:#ccfbf1,stroke:#0d9488,stroke-width:2px;
`.trim();

  const ast = parseMermaidFlowchart(code);

  assert.equal(ast.nodes.size, 3);

  for (const id of ['A', 'B', 'C']) {
    const s = getNodeStyle(ast, id);
    assert.ok(s, `Node ${id} should have style`);
    assert.equal(s.fill, '#ccfbf1');
    assert.equal(s.stroke, '#0d9488');
    assert.equal(s['stroke-width'], '2px');
  }

  // Modifying A keeps B and C intact
  updateNodeStyle(ast, 'A', { fill: '#fef08a' });
  assert.equal(getNodeStyle(ast, 'A')?.fill, '#fef08a');
  assert.equal(getNodeStyle(ast, 'B')?.fill, '#ccfbf1');
  assert.equal(getNodeStyle(ast, 'C')?.fill, '#ccfbf1');

  const serialized = serializeMermaidFlowchart(ast);
  assert.match(serialized, /style A fill:#fef08a/);
  assert.match(serialized, /style B fill:#ccfbf1/);
  assert.match(serialized, /style C fill:#ccfbf1/);
});

test('External Styles: Multi-target style with spaces e.g. style A, B, C fill:...', () => {
  const code = `
flowchart TD
    A[Node A]
    B[Node B]
    style A, B fill:#ede9fe,stroke:#7c3aed
`.trim();

  const ast = parseMermaidFlowchart(code);

  assert.equal(getNodeStyle(ast, 'A')?.fill, '#ede9fe');
  assert.equal(getNodeStyle(ast, 'B')?.fill, '#ede9fe');
});

test('External Styles: classDef default applies to unstyled nodes and is overridable', () => {
  const code = `
flowchart LR
    A[Default Node] --> B[Custom Node]
    classDef default fill:#f1f5f9,stroke:#64748b,color:#0f172a
    style B fill:#ecfdf5,stroke:#10b981
`.trim();

  const ast = parseMermaidFlowchart(code);

  // A inherits default
  const styleA = getNodeStyle(ast, 'A');
  assert.ok(styleA);
  assert.equal(styleA.fill, '#f1f5f9');
  assert.equal(styleA.stroke, '#64748b');

  // B has explicit style overriding default
  const styleB = getNodeStyle(ast, 'B');
  assert.ok(styleB);
  assert.equal(styleB.fill, '#ecfdf5');
  assert.equal(styleB.stroke, '#10b981');

  // User styles node A with Rose preset
  updateNodeStyle(ast, 'A', {
    fill: '#ffe4e6',
    stroke: '#e11d48',
  });

  assert.equal(getNodeStyle(ast, 'A')?.fill, '#ffe4e6');
  assert.equal(getNodeStyle(ast, 'A')?.stroke, '#e11d48');

  const serialized = serializeMermaidFlowchart(ast);
  assert.match(serialized, /classDef default fill:#f1f5f9,stroke:#64748b,color:#0f172a/);
  assert.match(serialized, /style A fill:#ffe4e6,stroke:#e11d48/);
  assert.match(serialized, /style B fill:#ecfdf5,stroke:#10b981/);
});

test('External Styles: Batch multi-select styling and clearing of class-styled nodes', () => {
  const code = `
flowchart TD
    N1[First] --> N2[Second] --> N3[Third]
    classDef teamA fill:#e0e7ff,stroke:#4338ca
    class N1,N2,N3 teamA
`.trim();

  const ast = parseMermaidFlowchart(code);

  // Batch update all 3 nodes to Emerald
  updateNodesStyle(ast, ['N1', 'N2', 'N3'], {
    fill: '#d1fae5',
    stroke: '#059669',
  });

  for (const id of ['N1', 'N2', 'N3']) {
    assert.equal(getNodeStyle(ast, id)?.fill, '#d1fae5');
    assert.equal(ast.nodes.get(id)?.classes, undefined);
  }

  // Batch clear all 3 nodes
  clearNodesStyle(ast, ['N1', 'N2', 'N3']);

  for (const id of ['N1', 'N2', 'N3']) {
    assert.equal(getNodeStyle(ast, id), undefined);
  }

  const serialized = serializeMermaidFlowchart(ast);
  assert.doesNotMatch(serialized, /style N/);
  assert.doesNotMatch(serialized, /class N/);
});

test('External Styles: Round-trip idempotency on complex external diagram', () => {
  const input = `
flowchart TB
    A["API Gateway"]:::gateway --> B["Auth Service"]:::auth
    B --> C["Database"]:::db
    classDef gateway fill:#e0f2fe,stroke:#0284c7
    classDef auth fill:#fef3c7,stroke:#d97706
    classDef db fill:#f3e8ff,stroke:#7c3aed
`.trim();

  const ast1 = parseMermaidFlowchart(input);
  const out1 = serializeMermaidFlowchart(ast1);

  const ast2 = parseMermaidFlowchart(out1);
  const out2 = serializeMermaidFlowchart(ast2);

  assert.equal(out1, out2);
  assert.equal(ast2.nodes.size, 3);
  assert.equal(getNodeStyle(ast2, 'A')?.fill, '#e0f2fe');
  assert.equal(getNodeStyle(ast2, 'B')?.fill, '#fef3c7');
  assert.equal(getNodeStyle(ast2, 'C')?.fill, '#f3e8ff');
});

test('External Styles: Overriding color on node with multiple duplicate/conflicting style lines (user diagram)', () => {
  const code = `
flowchart LR
    A(("Start"))
    B(("Process"))
    C(("End"))
    node_1003(("New Node 1123"))
    node_3954(("New Step"))
    node_9721(("New Step"))
    node_3807(("New Step"))
    node_0246(("New Step"))
    node_1537(("New Step"))
    node_2319(("wow 2"))

    A --> B
    B --> node_3954
    A --> node_3807
    A --> node_0246
    A --> node_1537
    node_1003 --> node_9721
    node_3954 --> node_2319
    node_2319 --> C
    node_1537 --> node_1003
    A --> C

    style B fill:#334155,stroke:#0f172a,color:#f8fafc
    style C fill:#ede9fe,stroke:#7c3aed,color:#5b21b6
    style B fill:#ec7500,stroke:#ec7500,color:#ffffff
    style C fill:#08b94e,stroke:#08b94e,color:#ffffff
    style C fill:#08b94e,stroke:#08b94e,color:#ffffff
    style C fill:#08b94e,stroke:#08b94e,color:#ffffff
    style C fill:#08b94e,stroke:#08b94e,color:#ffffff
    style C fill:#08b94e,stroke:#08b94e,color:#ffffff
    style A fill:#ede9fe,stroke:#7c3aed,color:#5b21b6
    style node_1003 fill:#ede9fe,stroke:#7c3aed,color:#5b21b6
    style node_3954 fill:#ede9fe,stroke:#7c3aed,color:#5b21b6
    style node_9721 fill:#ede9fe,stroke:#7c3aed,color:#5b21b6
    style node_3807 fill:#ede9fe,stroke:#7c3aed,color:#5b21b6
    style node_0246 fill:#ede9fe,stroke:#7c3aed,color:#5b21b6
    style node_1537 fill:#ede9fe,stroke:#7c3aed,color:#5b21b6
    style node_2319 fill:#ede9fe,stroke:#7c3aed,color:#5b21b6
`.trim();

  const ast = parseMermaidFlowchart(code);

  // Initial parsed style of B should be the latest style (#ec7500 orange)
  const initialStyleB = getNodeStyle(ast, 'B');
  assert.ok(initialStyleB);
  assert.equal(initialStyleB.fill, '#ec7500');

  // Initial parsed style of C should be #08b94e
  const initialStyleC = getNodeStyle(ast, 'C');
  assert.ok(initialStyleC);
  assert.equal(initialStyleC.fill, '#08b94e');

  // Override B with Sky theme
  updateNodeStyle(ast, 'B', {
    fill: '#e0f2fe',
    stroke: '#0284c7',
    color: '#0369a1',
  });

  assert.equal(getNodeStyle(ast, 'B')?.fill, '#e0f2fe');

  // Serialize and verify
  const serialized = serializeMermaidFlowchart(ast);

  // Must contain new style for B
  assert.match(serialized, /style B fill:#e0f2fe,stroke:#0284c7,color:#0369a1/);

  // Must NOT contain old orange style or slate style for B
  assert.doesNotMatch(serialized, /style B fill:#ec7500/);
  assert.doesNotMatch(serialized, /style B fill:#334155/);

  // There should be EXACTLY ONE 'style B' in the entire serialized output
  const styleBMatches = serialized.match(/style B /g);
  assert.equal(styleBMatches?.length, 1);

  // There should be EXACTLY ONE 'style C' in the entire serialized output (deduplicated)
  const styleCMatches = serialized.match(/style C /g);
  assert.equal(styleCMatches?.length, 1);

  // Reparse and ensure B is still #e0f2fe
  const reparsed = parseMermaidFlowchart(serialized);
  assert.equal(getNodeStyle(reparsed, 'B')?.fill, '#e0f2fe');
  assert.equal(getNodeStyle(reparsed, 'B')?.stroke, '#0284c7');
});

