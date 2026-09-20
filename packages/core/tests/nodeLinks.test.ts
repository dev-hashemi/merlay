import test from 'node:test';
import assert from 'node:assert/strict';

import {
  parseClickLink,
  parseSequenceLink,
  findNodeLinkUrl,
} from '../src/diagrams/nodeLinks';
import { FlowchartDriver } from '../src/diagrams/flowchart/flowchartDriver';
import { StateDiagramDriver } from '../src/diagrams/state/stateDriver';
import { SequenceDiagramDriver } from '../src/diagrams/sequence/sequenceDriver';

test('nodeLinks: parse click statements', () => {
  assert.deepStrictEqual(parseClickLink('click step_1 "https://google.com"'), {
    nodeId: 'step_1',
    url: 'https://google.com',
  });
  assert.deepStrictEqual(
    parseClickLink('click A href "https://example.com" "tip" _blank'),
    { nodeId: 'A', url: 'https://example.com' }
  );
  assert.deepStrictEqual(parseClickLink("click A href 'https://example.com'"), {
    nodeId: 'A',
    url: 'https://example.com',
  });
  // Callback form has no URL to open
  assert.strictEqual(parseClickLink('click B call myFunc() "tip"'), null);
  // Not a click statement
  assert.strictEqual(parseClickLink('click --> X'), null);
  assert.strictEqual(parseClickLink('click'), null);
  assert.strictEqual(parseClickLink('A --> B'), null);
});

test('nodeLinks: parse sequence link statements', () => {
  assert.deepStrictEqual(
    parseSequenceLink('link Alice: Dashboard @ https://example.com'),
    { nodeId: 'Alice', url: 'https://example.com' }
  );
  assert.deepStrictEqual(
    parseSequenceLink('links Bob: {"Wiki": "https://wiki.example.com"}'),
    { nodeId: 'Bob', url: 'https://wiki.example.com' }
  );
  assert.strictEqual(parseSequenceLink('Alice->>Bob: Hi'), null);
});

test('nodeLinks: findNodeLinkUrl scans raw lines', () => {
  const lines = [
    '%% a comment',
    'click step_1 "https://google.com"',
    'link Alice: Dashboard @ https://example.com',
  ];
  assert.strictEqual(findNodeLinkUrl(lines, 'step_1'), 'https://google.com');
  assert.strictEqual(findNodeLinkUrl(lines, 'Alice'), 'https://example.com');
  assert.strictEqual(findNodeLinkUrl(lines, 'Nobody'), undefined);
});

test('nodeLinks: every editable driver exposes getNodeLink', () => {
  const flowAst = FlowchartDriver.parse(
    'flowchart LR\n    step_1["google"]\n    click step_1 "https://google.com"\n'
  );
  assert.strictEqual(FlowchartDriver.getNodeLink?.(flowAst, 'step_1'), 'https://google.com');
  assert.strictEqual(FlowchartDriver.getNodeLink?.(flowAst, 'missing'), undefined);

  const stateAst = StateDiagramDriver.parse(
    'stateDiagram-v2\n    [*] --> Idle\n    click Idle href "https://example.com"\n'
  );
  assert.strictEqual(StateDiagramDriver.getNodeLink?.(stateAst, 'Idle'), 'https://example.com');
  assert.strictEqual(StateDiagramDriver.getNodeLink?.(stateAst, 'missing'), undefined);

  const seqAst = SequenceDiagramDriver.parse(
    'sequenceDiagram\n    participant Alice\n    link Alice: Dash @ https://example.com\n'
  );
  assert.strictEqual(SequenceDiagramDriver.getNodeLink?.(seqAst, 'Alice'), 'https://example.com');
  assert.strictEqual(SequenceDiagramDriver.getNodeLink?.(seqAst, 'missing'), undefined);
});
