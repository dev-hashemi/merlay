import test from 'node:test';
import assert from 'node:assert/strict';
import { getDriver } from '../src/diagrams/registry';
import { parseMermaidFlowchart } from '../src/diagrams/flowchart/parser';
import { serializeMermaidFlowchart } from '../src/diagrams/flowchart/serializer';
import {
  getDefaultNodeStyle,
  updateDefaultNodeStyle,
  clearDefaultNodeStyle,
  getDefaultEdgeStyle,
  updateDefaultEdgeStyle,
  clearDefaultEdgeStyle,
  addNode,
  addChildNode,
  updateNodeStyle,
  clearNodeStyle,
  getNodeStyle,
} from '../src/diagrams/flowchart/mutations';
import { connectNodes, insertNodeOnEdge } from '../src/diagrams/flowchart/mutations/edgeMutations';

const flowchartDriver = getDriver('flowchart')!;
const stateDriver = getDriver('stateDiagram')!;

test('Default Theme: updateDefaultNodeStyle sets classDef default and serializes cleanly', () => {
  const code = `
flowchart LR
    A[Start] --> B[End]
`.trim();

  const ast = parseMermaidFlowchart(code);
  assert.equal(getDefaultNodeStyle(ast), undefined);

  // Set default theme to Violet preset
  updateDefaultNodeStyle(ast, {
    fill: '#ede9fe',
    stroke: '#7c3aed',
    color: '#5b21b6',
  });

  const defaultStyle = getDefaultNodeStyle(ast);
  assert.ok(defaultStyle);
  assert.equal(defaultStyle.fill, '#ede9fe');
  assert.equal(defaultStyle.stroke, '#7c3aed');
  assert.equal(defaultStyle.color, '#5b21b6');

  // Serialization emits clean standard classDef default without per-node style pollution
  const serialized = serializeMermaidFlowchart(ast);
  assert.match(serialized, /classDef default fill:#ede9fe,stroke:#7c3aed,color:#5b21b6/);
  assert.doesNotMatch(serialized, /style A/);
  assert.doesNotMatch(serialized, /style B/);
});

test('Default Theme: Newly added and sprouted nodes inherit diagram default style', () => {
  const code = `
flowchart LR
    A[Start]
    classDef default fill:#d1fae5,stroke:#059669,color:#065f46
`.trim();

  const ast = parseMermaidFlowchart(code);

  // Adding a new node inherits default style
  const newNodeId = addNode(ast, 'New Step');
  const newNode = ast.nodes.get(newNodeId);
  assert.ok(newNode);
  assert.equal(newNode.style?.fill, '#d1fae5');
  assert.equal(newNode.style?.stroke, '#059669');

  // Sprouting a child node also inherits default style
  const { nodeId: childId } = addChildNode(ast, newNodeId, 'Next Step');
  const childNode = ast.nodes.get(childId);
  assert.ok(childNode);
  assert.equal(childNode.style?.fill, '#d1fae5');

  // Serializing does not inject inline styles for the newly created nodes
  const serialized = serializeMermaidFlowchart(ast);
  assert.match(serialized, /classDef default fill:#d1fae5,stroke:#059669,color:#065f46/);
  assert.doesNotMatch(serialized, /style step/);
});

test('Default Theme: Individual nodes can override default and reset back to default', () => {
  const code = `
flowchart LR
    A[Normal] --> B[Alert]
    classDef default fill:#e0f2fe,stroke:#0284c7,color:#0369a1
`.trim();

  const ast = parseMermaidFlowchart(code);

  // Node B gets custom Rose (Danger) override
  updateNodeStyle(ast, 'B', {
    fill: '#ffe4e6',
    stroke: '#e11d48',
    color: '#9f1239',
  });

  assert.equal(getNodeStyle(ast, 'A')?.fill, '#e0f2fe'); // Default
  assert.equal(getNodeStyle(ast, 'B')?.fill, '#ffe4e6'); // Custom override

  let serialized = serializeMermaidFlowchart(ast);
  assert.match(serialized, /classDef default fill:#e0f2fe,stroke:#0284c7,color:#0369a1/);
  assert.match(serialized, /style B fill:#ffe4e6,stroke:#e11d48,color:#9f1239/);
  assert.doesNotMatch(serialized, /style A/);

  // Resetting node B brings it back to diagram default
  clearNodeStyle(ast, 'B');
  assert.equal(getNodeStyle(ast, 'B')?.fill, '#e0f2fe');

  serialized = serializeMermaidFlowchart(ast);
  assert.match(serialized, /classDef default/);
  assert.doesNotMatch(serialized, /style B/);
});

test('Default Theme: Clearing default node style removes classDef default', () => {
  const code = `
flowchart LR
    A[Start] --> B[End]
    classDef default fill:#ede9fe,stroke:#7c3aed,color:#5b21b6
`.trim();

  const ast = parseMermaidFlowchart(code);
  assert.ok(getDefaultNodeStyle(ast));

  clearDefaultNodeStyle(ast);
  assert.equal(getDefaultNodeStyle(ast), undefined);

  const serialized = serializeMermaidFlowchart(ast);
  assert.doesNotMatch(serialized, /classDef default/);
});

test('Default Edge Style: linkStyle default sets default edge theme and avoids redundant linkStyle indices', () => {
  const code = `
flowchart LR
    A --> B
    B --> C
`.trim();

  const ast = parseMermaidFlowchart(code);
  assert.equal(getDefaultEdgeStyle(ast), undefined);

  // Set default edge style to Violet
  updateDefaultEdgeStyle(ast, {
    stroke: '#7c3aed',
    'stroke-width': '2px',
  });

  assert.equal(getDefaultEdgeStyle(ast)?.stroke, '#7c3aed');

  // Serializer emits linkStyle default
  let serialized = serializeMermaidFlowchart(ast);
  assert.match(serialized, /linkStyle default stroke:#7c3aed,stroke-width:2px/);
  // Does not emit linkStyle 0 or linkStyle 1 because they match default
  assert.doesNotMatch(serialized, /linkStyle 0/);
  assert.doesNotMatch(serialized, /linkStyle 1/);

  // Newly connected edge inherits default edge style
  const newEdgeId = connectNodes(ast, 'A', 'C');
  assert.ok(newEdgeId);
  const newEdge = ast.edges.find((e) => e.id === newEdgeId);
  assert.equal(newEdge?.style?.stroke, '#7c3aed');

  // Custom edge style override on edge 0 emits specific linkStyle 0
  ast.edges[0].style = { stroke: '#ef4444' };
  serialized = serializeMermaidFlowchart(ast);
  assert.match(serialized, /linkStyle default stroke:#7c3aed,stroke-width:2px/);
  assert.match(serialized, /linkStyle 0 stroke:#ef4444/);
  assert.doesNotMatch(serialized, /linkStyle 1/);

  // Clear default edge style
  clearDefaultEdgeStyle(ast);
  assert.equal(getDefaultEdgeStyle(ast), undefined);
});

test('Default Theme: State diagram driver supports default styles via classDef default in rawLines', () => {
  const code = `
stateDiagram-v2
    [*] --> Idle
    Idle --> Active
    Active --> [*]
`.trim();

  const ast = stateDriver.parse(code);
  assert.equal(stateDriver.mutations.getDefaultStyle?.(ast), undefined);

  // Set default state style
  stateDriver.mutations.updateDefaultStyle?.(ast, {
    fill: '#ccfbf1',
    stroke: '#0d9488',
    color: '#115e59',
  });

  const defaultStyle = stateDriver.mutations.getDefaultStyle?.(ast);
  assert.ok(defaultStyle);
  assert.equal(defaultStyle.fill, '#ccfbf1');
  assert.equal(defaultStyle.stroke, '#0d9488');

  // Serialization preserves classDef default
  let serialized = stateDriver.serialize(ast);
  assert.match(serialized, /classDef default fill:#ccfbf1,stroke:#0d9488,color:#115e59/);

  // Clear default state style
  stateDriver.mutations.clearDefaultStyle?.(ast);
  assert.equal(stateDriver.mutations.getDefaultStyle?.(ast), undefined);
  serialized = stateDriver.serialize(ast);
  assert.doesNotMatch(serialized, /classDef default/);
});

test('Default Theme: insertNodeOnEdge inherits default node and edge styles', () => {
  const code = `
flowchart LR
    A[Start] --> B[End]
    classDef default fill:#ede9fe,stroke:#7c3aed
    linkStyle default stroke:#7c3aed,stroke-width:2px
`.trim();

  const ast = parseMermaidFlowchart(code);
  const oldEdge = ast.edges[0];
  assert.ok(oldEdge);

  const res = insertNodeOnEdge(ast, oldEdge.id, 'Intermediate');
  assert.ok(res);

  const newNode = ast.nodes.get(res.nodeId);
  assert.ok(newNode);
  assert.equal(newNode.style?.fill, '#ede9fe');
  assert.equal(newNode.style?.stroke, '#7c3aed');

  const edge1 = ast.edges.find((e) => e.id === res.edge1Id);
  const edge2 = ast.edges.find((e) => e.id === res.edge2Id);
  assert.equal(edge1?.style?.stroke, '#7c3aed');
  assert.equal(edge2?.style?.stroke, '#7c3aed');
});

test('Default Theme: State diagram parser reconciles classDef default onto states, and addState inherits it', () => {
  const code = `
stateDiagram-v2
    classDef default fill:#dbeafe,stroke:#2563eb
    [*] --> Idle
    Idle --> Processing
`.trim();

  const ast = stateDriver.parse(code);
  const idle = ast.states.get('Idle');
  assert.ok(idle);
  assert.equal(idle.style?.fill, '#dbeafe');
  assert.equal(idle.style?.stroke, '#2563eb');

  // Adding a new state inherits default state style
  const newId = stateDriver.mutations.addNode(ast, 'New State');
  const newState = ast.states.get(newId);
  assert.ok(newState);
  assert.equal(newState.style?.fill, '#dbeafe');
  assert.equal(newState.style?.stroke, '#2563eb');
});
