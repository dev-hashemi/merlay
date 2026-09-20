import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMermaidFlowchart } from '../src/diagrams/flowchart/parser';
import { serializeMermaidFlowchart } from '../src/diagrams/flowchart/serializer';
import {
  updateEdgeStyle,
  clearEdgeStyle,
  getEdgeStyle,
  deleteEdge,
} from '../src/diagrams/flowchart/mutations';

test('Edge Styles Parser: parses linkStyle with single index', () => {
  const code = `flowchart TD
  A --> B
  B --> C
  linkStyle 0 stroke:#7c3aed,stroke-width:3px,color:#ffffff
  linkStyle 1 stroke:#10b981,stroke-width:2px`;

  const ast = parseMermaidFlowchart(code);
  assert.equal(ast.edges.length, 2);

  assert.deepEqual(ast.edges[0].style, {
    stroke: '#7c3aed',
    'stroke-width': '3px',
    color: '#ffffff',
  });

  assert.deepEqual(ast.edges[1].style, {
    stroke: '#10b981',
    'stroke-width': '2px',
  });
});

test('Edge Styles Parser: parses linkStyle with multiple comma-separated indices', () => {
  const code = `flowchart TD
  A --> B
  B --> C
  C --> D
  linkStyle 0,2 stroke:#ef4444,stroke-width:4px`;

  const ast = parseMermaidFlowchart(code);
  assert.equal(ast.edges.length, 3);

  assert.equal(ast.edges[0].style?.stroke, '#ef4444');
  assert.equal(ast.edges[0].style?.['stroke-width'], '4px');
  assert.equal(ast.edges[1].style, undefined);
  assert.equal(ast.edges[2].style?.stroke, '#ef4444');
  assert.equal(ast.edges[2].style?.['stroke-width'], '4px');
});

test('Edge Styles Parser: parses linkStyle default', () => {
  const code = `flowchart TD
  A --> B
  B --> C
  linkStyle default stroke:#64748b,stroke-width:1px`;

  const ast = parseMermaidFlowchart(code);
  assert.equal(ast.edges.length, 2);

  assert.equal(ast.edges[0].style?.stroke, '#64748b');
  assert.equal(ast.edges[1].style?.stroke, '#64748b');
});

test('Edge Styles Serializer: emits linkStyle statements matching edge indices', () => {
  const code = `flowchart TD
  A --> B
  B --> C`;

  const ast = parseMermaidFlowchart(code);
  updateEdgeStyle(ast, ast.edges[0].id, {
    stroke: '#7c3aed',
    'stroke-width': '2px',
  });

  const serialized = serializeMermaidFlowchart(ast);
  assert.ok(serialized.includes('linkStyle 0 stroke:#7c3aed,stroke-width:2px'));

  // Re-parse the serialized output to verify round-trip idempotency
  const reparsed = parseMermaidFlowchart(serialized);
  assert.equal(reparsed.edges[0].style?.stroke, '#7c3aed');
  assert.equal(reparsed.edges[0].style?.['stroke-width'], '2px');
});

test('Edge Styles Mutations: updateEdgeStyle, clearEdgeStyle, and getEdgeStyle', () => {
  const code = `flowchart LR
  Start --> Stop`;

  const ast = parseMermaidFlowchart(code);
  const edgeId = ast.edges[0].id;

  assert.equal(getEdgeStyle(ast, edgeId), undefined);

  // Apply style
  updateEdgeStyle(ast, edgeId, {
    stroke: '#10b981',
    'stroke-width': '3px',
    'stroke-dasharray': '5 5',
    color: '#10b981',
  });

  const style = getEdgeStyle(ast, edgeId);
  assert.equal(style?.stroke, '#10b981');
  assert.equal(style?.['stroke-width'], '3px');
  assert.equal(style?.['stroke-dasharray'], '5 5');
  assert.equal(style?.color, '#10b981');

  // Clear style
  clearEdgeStyle(ast, edgeId);
  assert.equal(getEdgeStyle(ast, edgeId), undefined);

  const serialized = serializeMermaidFlowchart(ast);
  assert.ok(!serialized.includes('linkStyle'));
});

test('Edge Styles Resiliency: deleting an intermediate edge updates remaining linkStyle indices', () => {
  const code = `flowchart TD
  A --> B
  B --> C
  C --> D`;

  const ast = parseMermaidFlowchart(code);
  assert.equal(ast.edges.length, 3);

  // Style first edge (index 0: A-->B) and third edge (index 2: C-->D)
  updateEdgeStyle(ast, ast.edges[0].id, { stroke: '#7c3aed' });
  updateEdgeStyle(ast, ast.edges[2].id, { stroke: '#ef4444' });

  // Delete the middle edge (B-->C)
  deleteEdge(ast, ast.edges[1].id);
  assert.equal(ast.edges.length, 2);

  // Now ast.edges[0] is A-->B (with #7c3aed) and ast.edges[1] is C-->D (with #ef4444)
  const serialized = serializeMermaidFlowchart(ast);

  // The linkStyle for C-->D MUST now be serialized as index 1 (not 2)!
  assert.ok(serialized.includes('linkStyle 0 stroke:#7c3aed'));
  assert.ok(serialized.includes('linkStyle 1 stroke:#ef4444'));
  assert.ok(!serialized.includes('linkStyle 2'));
});
