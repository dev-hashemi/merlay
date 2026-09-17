import test from 'node:test';
import assert from 'node:assert/strict';

import { parseMermaidFlowchart } from '../src/diagrams/flowchart/parser.ts';
import { serializeMermaidFlowchart } from '../src/diagrams/flowchart/serializer.ts';
import { addChildNode } from '../src/diagrams/flowchart/mutations/index.ts';

// Regression test for https://github.com/dev-hashemi/merlay/issues/4
// A `click` interaction line must never be split into bogus nodes — it is
// preserved verbatim and survives visual edits (parse → mutate → serialize).
test('Issue #4: click keyword survives visual edits verbatim', () => {
  const code = `flowchart LR
    step_1["google"]

    click step_1 "https://google.com"`;

  const ast = parseMermaidFlowchart(code);

  // No bogus nodes from the click statement
  assert.ok(!ast.nodes.has('click'), 'click must not become a node');
  assert.ok(
    !ast.nodes.has('https://google.com'),
    'click URL must not become a node'
  );
  assert.equal(ast.nodes.size, 1);
  assert.ok(ast.nodes.has('step_1'));

  // Click line preserved verbatim
  assert.equal(ast.rawLines.length, 1);
  assert.equal(ast.rawLines[0].text, 'click step_1 "https://google.com"');

  // Visual edit: select "google" and sprout "Next step"
  addChildNode(ast, 'step_1', 'Next Step');
  const serialized = serializeMermaidFlowchart(ast);

  assert.ok(
    serialized.includes('click step_1 "https://google.com"'),
    'click line must survive the sprout edit verbatim'
  );
  assert.ok(!serialized.includes('click["click"]'), 'no bogus click node');
  assert.ok(
    !serialized.includes('https://google.com["https://google.com"]'),
    'no bogus URL node'
  );

  // Round-trip is stable
  const reparsed = parseMermaidFlowchart(serialized);
  assert.equal(reparsed.nodes.size, 2);
  assert.ok(!reparsed.nodes.has('click'));
  assert.equal(
    serializeMermaidFlowchart(reparsed),
    serialized,
    'serialize must be idempotent'
  );
});

test('Issue #4: click href/call variants are preserved verbatim', () => {
  const code = `flowchart LR
    A["a"]
    B["b"]
    click A href "https://example.com" "tip" _blank
    click B call myFunc() "tip"`;

  const ast = parseMermaidFlowchart(code);
  assert.equal(ast.nodes.size, 2);
  assert.ok(!ast.nodes.has('click'));
  assert.equal(ast.rawLines.length, 2);

  const serialized = serializeMermaidFlowchart(ast);
  assert.ok(
    serialized.includes('click A href "https://example.com" "tip" _blank')
  );
  assert.ok(serialized.includes('click B call myFunc() "tip"'));
});

test('Issue #4: a node literally named click still works', () => {
  const code = `flowchart LR
    click --> X
    X["ex"]`;

  const ast = parseMermaidFlowchart(code);
  assert.ok(ast.nodes.has('click'), 'node named click must still parse');
  assert.equal(ast.edges.length, 1);
  assert.equal(ast.rawLines.length, 0);

  const nodeCode = `flowchart LR
    click["Click label"] --> X`;
  const nodeAst = parseMermaidFlowchart(nodeCode);
  assert.equal(nodeAst.nodes.get('click')?.label, 'Click label');
  assert.equal(nodeAst.rawLines.length, 0);
});
