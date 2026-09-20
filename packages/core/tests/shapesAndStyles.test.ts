import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMermaidFlowchart } from '../src/diagrams/flowchart/parser';
import { serializeMermaidFlowchart } from '../src/diagrams/flowchart/serializer';
import { MermaidShapeType } from '../src/diagrams/viewModel';
import {
  updateNodeShape,
  updateNodeStyle,
  clearNodeStyle,
  getNodeStyle,
} from '../src/diagrams/flowchart/mutations';

test('Shapes: Exhaustive test of all 14 Mermaid flowchart shapes', () => {
  const code = `
flowchart TD
    S1[Rectangle Shape]
    S2(Rounded Shape)
    S3([Stadium Shape])
    S4[[Subroutine Shape]]
    S5[(Cylinder Database)]
    S6((Circle Shape))
    S7(((Double Circle Shape)))
    S8{Diamond Decision}
    S9{{Hexagon Shape}}
    S10[/Parallelogram Right/]
    S11[\\Parallelogram Left\\]
    S12[/Trapezoid Shape\\]
    S13[\\Inverted Trapezoid/]
    S14>Asymmetric Banner]

    S1 --> S2 --> S3 --> S4 --> S5 --> S6 --> S7
    S7 --> S8 --> S9 --> S10 --> S11 --> S12 --> S13 --> S14
`.trim();

  const ast = parseMermaidFlowchart(code);
  assert.equal(ast.nodes.size, 14);

  const expectedShapes: Record<string, MermaidShapeType> = {
    S1: 'rectangle',
    S2: 'rounded',
    S3: 'stadium',
    S4: 'subroutine',
    S5: 'cylinder',
    S6: 'circle',
    S7: 'double_circle',
    S8: 'diamond',
    S9: 'hexagon',
    S10: 'parallelogram',
    S11: 'parallelogram_alt',
    S12: 'trapezoid',
    S13: 'trapezoid_alt',
    S14: 'asymmetric',
  };

  for (const [id, expectedShape] of Object.entries(expectedShapes)) {
    const node = ast.nodes.get(id);
    assert.ok(node, `Node ${id} must exist`);
    assert.equal(node.shape, expectedShape, `Node ${id} shape should be ${expectedShape}`);
  }

  // Roundtrip serialization must preserve all 14 shapes exactly
  const serialized = serializeMermaidFlowchart(ast);
  assert.match(serialized, /S1\["Rectangle Shape"\]/);
  assert.match(serialized, /S2\("Rounded Shape"\)/);
  assert.match(serialized, /S3\(\["Stadium Shape"\]\)/);
  assert.match(serialized, /S4\[\["Subroutine Shape"\]\]/);
  assert.match(serialized, /S5\[\("Cylinder Database"\)\]/);
  assert.match(serialized, /S6\(\("Circle Shape"\)\)/);
  assert.match(serialized, /S7\(\(\("Double Circle Shape"\)\)\)/);
  assert.match(serialized, /S8\{"Diamond Decision"\}/);
  assert.match(serialized, /S9\{\{"Hexagon Shape"\}\}/);
  assert.match(serialized, /S10\[\/"Parallelogram Right"\//);
  assert.match(serialized, /S11\[\\"Parallelogram Left"\\\]/);
  assert.match(serialized, /S12\[\/"Trapezoid Shape"\\\]/);
  assert.match(serialized, /S13\[\\"Inverted Trapezoid"\//);
  assert.match(serialized, /S14>"Asymmetric Banner"\]/);

  const reparsed = parseMermaidFlowchart(serialized);
  assert.equal(reparsed.nodes.size, 14);
  for (const [id, expectedShape] of Object.entries(expectedShapes)) {
    assert.equal(reparsed.nodes.get(id)?.shape, expectedShape);
  }
});

test('Shapes: Morphing a node dynamically across all 14 shape types', () => {
  const ast = parseMermaidFlowchart('flowchart LR\n    NodeA["Morph Target"]');
  const allShapes: MermaidShapeType[] = [
    'rectangle',
    'rounded',
    'stadium',
    'subroutine',
    'cylinder',
    'circle',
    'double_circle',
    'diamond',
    'hexagon',
    'parallelogram',
    'parallelogram_alt',
    'trapezoid',
    'trapezoid_alt',
    'asymmetric',
  ];

  for (const shape of allShapes) {
    updateNodeShape(ast, 'NodeA', shape);
    assert.equal(ast.nodes.get('NodeA')?.shape, shape);

    const serialized = serializeMermaidFlowchart(ast);
    const reparsed = parseMermaidFlowchart(serialized);
    assert.equal(reparsed.nodes.get('NodeA')?.shape, shape);
  }
});

test('Visual Tweaks: Parsing and serializing fill, stroke, stroke-width, stroke-dasharray, and color', () => {
  const code = `
flowchart TD
    Task1["Styled Task"]
    Task2["Dashed Task"]

    style Task1 fill:#d1fae5,stroke:#059669,stroke-width:3px,color:#065f46
    style Task2 fill:#ede9fe,stroke:#7c3aed,stroke-dasharray:5 5,color:#5b21b6
`.trim();

  const ast = parseMermaidFlowchart(code);
  assert.equal(ast.styles.length, 2);

  const task1Style = ast.nodes.get('Task1')?.style;
  assert.ok(task1Style);
  assert.equal(task1Style.fill, '#d1fae5');
  assert.equal(task1Style.stroke, '#059669');
  assert.equal(task1Style['stroke-width'], '3px');
  assert.equal(task1Style.color, '#065f46');

  const task2Style = ast.nodes.get('Task2')?.style;
  assert.ok(task2Style);
  assert.equal(task2Style.fill, '#ede9fe');
  assert.equal(task2Style.stroke, '#7c3aed');
  assert.equal(task2Style['stroke-dasharray'], '5 5');
  assert.equal(task2Style.color, '#5b21b6');

  // Serialization roundtrip
  const serialized = serializeMermaidFlowchart(ast);
  assert.ok(serialized.includes('style Task1 fill:#d1fae5,stroke:#059669,stroke-width:3px,color:#065f46'));
  assert.ok(serialized.includes('style Task2 fill:#ede9fe,stroke:#7c3aed,stroke-dasharray:5 5,color:#5b21b6'));

  const reparsed = parseMermaidFlowchart(serialized);
  assert.equal(reparsed.nodes.get('Task1')?.style?.fill, '#d1fae5');
  assert.equal(reparsed.nodes.get('Task2')?.style?.['stroke-dasharray'], '5 5');
});

test('Visual Tweaks: Mutations updateNodeStyle, clearNodeStyle, and getNodeStyle', () => {
  const ast = parseMermaidFlowchart('flowchart LR\n    Server["API Server"]');
  assert.equal(getNodeStyle(ast, 'Server'), undefined);

  // 1. Add style
  updateNodeStyle(ast, 'Server', {
    fill: '#38bdf8',
    stroke: '#0284c7',
    'stroke-width': '2px',
    color: '#ffffff',
  });

  const style1 = getNodeStyle(ast, 'Server');
  assert.ok(style1);
  assert.equal(style1.fill, '#38bdf8');
  assert.equal(style1.stroke, '#0284c7');
  assert.equal(style1['stroke-width'], '2px');
  assert.equal(style1.color, '#ffffff');

  // 2. Overwrite / update style with new values
  updateNodeStyle(ast, 'Server', {
    fill: '#ef4444',
    stroke: '#b91c1c',
    'stroke-dasharray': '2 2',
  });

  const style2 = getNodeStyle(ast, 'Server');
  assert.ok(style2);
  assert.equal(style2.fill, '#ef4444');
  assert.equal(style2.stroke, '#b91c1c');
  assert.equal(style2['stroke-dasharray'], '2 2');
  assert.equal(style2['stroke-width'], undefined);

  // 3. Clear style back to default
  clearNodeStyle(ast, 'Server');
  assert.equal(getNodeStyle(ast, 'Server'), undefined);
  assert.equal(ast.styles.length, 0);

  const serialized = serializeMermaidFlowchart(ast);
  assert.ok(!serialized.includes('style Server'));
});

test('Visual Tweaks: Applying all 8 Curated Theme Presets', () => {
  const themes = [
    { name: 'Emerald', fill: '#d1fae5', stroke: '#059669', color: '#065f46' },
    { name: 'Sky', fill: '#e0f2fe', stroke: '#0284c7', color: '#0369a1' },
    { name: 'Violet', fill: '#ede9fe', stroke: '#7c3aed', color: '#5b21b6' },
    { name: 'Amber', fill: '#fef3c7', stroke: '#d97706', color: '#92400e' },
    { name: 'Rose', fill: '#ffe4e6', stroke: '#e11d48', color: '#9f1239' },
    { name: 'Teal', fill: '#ccfbf1', stroke: '#0d9488', color: '#115e59' },
    { name: 'Slate', fill: '#334155', stroke: '#0f172a', color: '#f8fafc' },
  ];

  for (const theme of themes) {
    const ast = parseMermaidFlowchart('flowchart LR\n    Node1["Step"]');
    updateNodeStyle(ast, 'Node1', {
      fill: theme.fill,
      stroke: theme.stroke,
      color: theme.color,
    });

    const serialized = serializeMermaidFlowchart(ast);
    assert.ok(serialized.includes(`style Node1 fill:${theme.fill},stroke:${theme.stroke},color:${theme.color}`));

    const reparsed = parseMermaidFlowchart(serialized);
    assert.equal(reparsed.nodes.get('Node1')?.style?.fill, theme.fill);
    assert.equal(reparsed.nodes.get('Node1')?.style?.stroke, theme.stroke);
    assert.equal(reparsed.nodes.get('Node1')?.style?.color, theme.color);
  }
});
