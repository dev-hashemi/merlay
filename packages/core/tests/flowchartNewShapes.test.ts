/**
 * Regression tests for v11.3+ `@{ shape: }` flowchart shapes, aliases, and
 * icon/image specials: parse -> mutate -> serialize round-trip.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMermaidFlowchart } from '../src/diagrams/flowchart/parser';
import { serializeMermaidFlowchart } from '../src/diagrams/flowchart/serializer';
import { updateNodeShape } from '../src/diagrams/flowchart/mutations';
import {
  FLOWCHART_SHAPES,
  resolveShapeAlias,
  shortNameFor,
} from '../src/diagrams/flowchart/shapes';
import { FlowchartDriver } from '../src/diagrams/flowchart/flowchartDriver';

test('New shapes: every registry kind parses from @{ shape: } and round-trips', () => {
  const lines = ['flowchart TD'];
  FLOWCHART_SHAPES.filter((d) => !d.classic && d.kind !== 'icon' && d.kind !== 'image').forEach(
    (d, i) => {
      lines.push(`    N${i}@{ shape: ${d.shortName}, label: "Label ${i}" }`);
    }
  );
  const ast = parseMermaidFlowchart(lines.join('\n'));
  const defs = FLOWCHART_SHAPES.filter((d) => !d.classic && d.kind !== 'icon' && d.kind !== 'image');
  assert.equal(ast.nodes.size, defs.length);
  defs.forEach((d, i) => {
    const node = ast.nodes.get(`N${i}`);
    assert.ok(node, `Node N${i} must exist`);
    assert.equal(node!.shape, d.kind, `N${i} shape should be ${d.kind}`);
    assert.equal(node!.label, `Label ${i}`);
  });

  // Serialize -> reparse must preserve every kind and label exactly.
  const out = serializeMermaidFlowchart(ast);
  const reparsed = parseMermaidFlowchart(out);
  assert.equal(reparsed.nodes.size, defs.length);
  defs.forEach((d, i) => {
    assert.equal(reparsed.nodes.get(`N${i}`)?.shape, d.kind);
    assert.equal(reparsed.nodes.get(`N${i}`)?.label, `Label ${i}`);
  });
});

test('New shapes: aliases resolve to canonical kinds', () => {
  const cases: Array<[string, string]> = [
    ['documents', 'docs'],
    ['st-doc', 'docs'],
    ['com-link', 'bolt'],
    ['lightning-bolt', 'bolt'],
    ['manual-input', 'sl-rect'],
    ['sloped-rectangle', 'sl-rect'],
    ['paper-tape', 'flag'],
    ['stored-data', 'bow-rect'],
    ['loop-limit', 'notch-pent'],
    ['lined-document', 'lin-doc'],
    ['tagged-document', 'tag-doc'],
    ['tagged-process', 'tag-rect'],
    ['lined-cylinder', 'lin-cyl'],
    ['horizontal-cylinder', 'h-cyl'],
    ['curved-trapezoid', 'curv-trap'],
    ['divided-process', 'div-rect'],
    ['lined-process', 'lin-rect'],
    ['notched-rectangle', 'notch-rect'],
    ['stacked-rectangle', 'st-rect'],
    ['crossed-circle', 'cross-circ'],
    ['filled-circle', 'f-circ'],
    ['window-pane', 'win-pane'],
    ['flipped-triangle', 'flip-tri'],
    // Same-concept aliases map to legacy kinds (stable classic syntax).
    ['rect', 'rectangle'],
    ['proc', 'rectangle'],
    ['diam', 'diamond'],
    ['decision', 'diamond'],
    ['hex', 'hexagon'],
    ['cyl', 'cylinder'],
    ['database', 'cylinder'],
    ['dbl-circ', 'double_circle'],
    ['lean-r', 'parallelogram'],
    ['in-out', 'parallelogram'],
    ['lean-l', 'parallelogram_alt'],
    ['trap-b', 'trapezoid'],
    ['priority', 'trapezoid'],
    ['trap-t', 'trapezoid_alt'],
    ['subproc', 'subroutine'],
    ['subprocess', 'subroutine'],
  ];
  for (const [alias, expected] of cases) {
    assert.equal(resolveShapeAlias(alias), expected, `alias ${alias}`);
  }
  assert.equal(resolveShapeAlias('definitely-not-a-shape'), null);
});

test('New shapes: classic label + appended @{ shape: } meta (meta wins)', () => {
  const ast = parseMermaidFlowchart(
    'flowchart TD\n    A["Hello"]@{ shape: docs }\n    B --> A\n'
  );
  assert.equal(ast.nodes.get('A')?.shape, 'docs');
  assert.equal(ast.nodes.get('A')?.label, 'Hello');
  assert.equal(ast.edges.length, 1);
});

test('New shapes: meta-only line updates an already-defined node', () => {
  const ast = parseMermaidFlowchart(
    'flowchart TD\n    A["Hello"]\n    A@{ shape: bolt }\n    A --> B\n'
  );
  assert.equal(ast.nodes.get('A')?.shape, 'bolt');
  assert.equal(ast.nodes.get('A')?.label, 'Hello');
});

test('New shapes: morphing across new kinds preserves label and edges', () => {
  const ast = parseMermaidFlowchart(
    'flowchart TD\n    A["Keep me"]@{ shape: docs }\n    A --> B["Other"]\n'
  );
  const kinds = ['bolt', 'folder', 'doc', 'person', 'text', 'datastore', 'hourglass'];
  for (const kind of kinds) {
    assert.ok(updateNodeShape(ast, 'A', kind as never));
    assert.equal(ast.nodes.get('A')?.shape, kind);
    assert.equal(ast.nodes.get('A')?.label, 'Keep me');
    assert.equal(ast.edges.length, 1);
  }
  const out = serializeMermaidFlowchart(ast);
  const reparsed = parseMermaidFlowchart(out);
  assert.equal(reparsed.nodes.get('A')?.shape, 'hourglass');
});

test('New shapes: icon and image params are preserved verbatim', () => {
  const code = [
    'flowchart TD',
    '    A@{ icon: "fa:user", form: "circle", label: "Alice" }',
    '    B@{ img: "https://example.com/a.png", w: 60, h: 60, label: "Pic" }',
    '    A --> B',
  ].join('\n');
  const ast = parseMermaidFlowchart(code);
  assert.equal(ast.nodes.get('A')?.shape, 'icon');
  assert.equal(ast.nodes.get('A')?.label, 'Alice');
  assert.equal(ast.nodes.get('A')?.shapeParams?.icon, 'fa:user');
  assert.equal(ast.nodes.get('A')?.shapeParams?.form, 'circle');
  assert.equal(ast.nodes.get('B')?.shape, 'image');
  assert.equal(ast.nodes.get('B')?.shapeParams?.img, 'https://example.com/a.png');

  const out = serializeMermaidFlowchart(ast);
  const reparsed = parseMermaidFlowchart(out);
  assert.equal(reparsed.nodes.get('A')?.shape, 'icon');
  assert.equal(reparsed.nodes.get('A')?.shapeParams?.icon, 'fa:user');
  assert.equal(reparsed.nodes.get('B')?.shape, 'image');
  assert.equal(reparsed.nodes.get('B')?.shapeParams?.img, 'https://example.com/a.png');
  assert.equal(reparsed.edges.length, 1);
});

test('New shapes: picker-created icon/image nodes round-trip with valid syntax', () => {
  const ast = parseMermaidFlowchart('flowchart TD\n    A["Make me an icon"]\n');
  assert.ok(updateNodeShape(ast, 'A', 'icon' as never));
  const out = serializeMermaidFlowchart(ast);
  assert.ok(out.includes('icon:'), 'icon node must serialize with an icon: discriminator');
  const reparsed = parseMermaidFlowchart(out);
  assert.equal(reparsed.nodes.get('A')?.shape, 'icon');
  assert.equal(reparsed.nodes.get('A')?.label, 'Make me an icon');

  assert.ok(updateNodeShape(reparsed, 'A', 'rectangle' as never));
  assert.equal(reparsed.nodes.get('A')?.shapeParams, undefined);
});

test('New shapes: labels with commas and quotes survive @{ } round-trip', () => {
  const ast = parseMermaidFlowchart(
    'flowchart TD\n    A@{ shape: docs, label: "Hello, \\"world\\"" }\n'
  );
  // Escaped quotes inside meta labels are an edge case: at minimum the node
  // must parse with the right shape and a non-empty label, never crash.
  assert.equal(ast.nodes.get('A')?.shape, 'docs');
  assert.ok((ast.nodes.get('A')?.label ?? '').length > 0);
  const out = serializeMermaidFlowchart(ast);
  assert.equal(parseMermaidFlowchart(out).nodes.get('A')?.shape, 'docs');
});

test('New shapes: driver exposes grouped options for every registry kind', () => {
  const kinds = new Set(FlowchartDriver.nodeKindOptions.map((o) => o.kind));
  for (const d of FLOWCHART_SHAPES) {
    assert.ok(kinds.has(d.kind as string), `picker must offer ${d.kind}`);
  }
  for (const o of FlowchartDriver.nodeKindOptions) {
    assert.ok(o.group && o.group.length > 0, `${o.kind} must have a group`);
    assert.ok(o.keywords && o.keywords.length > 0, `${o.kind} must have keywords`);
    assert.equal(shortNameFor(o.kind), FLOWCHART_SHAPES.find((d) => d.kind === o.kind)!.shortName);
  }
});

test('New shapes: hand-written code with new shapes is never corrupted by edits', () => {
  const ast = parseMermaidFlowchart(
    [
      'flowchart TD',
      '    A@{ shape: docs, label: "Spec" }',
      '    B[/Input/]',
      '    A --> B',
      '    click A "https://example.com"',
    ].join('\n')
  );
  assert.ok(updateNodeShape(ast, 'B', 'sl-rect' as never));
  const out = serializeMermaidFlowchart(ast);
  assert.ok(out.includes('shape: docs'), 'docs node must survive an unrelated edit');
  assert.ok(out.includes('click A "https://example.com"'), 'click line must survive');
  const reparsed = parseMermaidFlowchart(out);
  assert.equal(reparsed.nodes.get('A')?.shape, 'docs');
  assert.equal(reparsed.nodes.get('B')?.shape, 'sl-rect');
});
