import test from 'node:test';
import assert from 'node:assert/strict';

import {
  parseClickLink,
  parseSequenceLink,
  findNodeLinkUrl,
  parseClickLinkDetails,
  parseSequenceLinkDetails,
  findNodeLinkDetails,
  formatNodeLinkStatement,
  updateNodeLinkInRawLines,
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

test('nodeLinks: parse details with tooltip and target', () => {
  const parsed1 = parseClickLinkDetails('click A href "https://example.com" "tooltip text" _blank');
  assert.deepStrictEqual(parsed1, {
    nodeId: 'A',
    details: {
      url: 'https://example.com',
      tooltip: 'tooltip text',
      target: '_blank',
    },
  });

  const parsed2 = parseSequenceLinkDetails('link Alice: Dashboard App @ https://dashboard.org');
  assert.deepStrictEqual(parsed2, {
    nodeId: 'Alice',
    details: {
      url: 'https://dashboard.org',
      tooltip: 'Dashboard App',
    },
  });

  const lines = ['click Node1 "https://test.io" "My Tooltip" _self'];
  const details = findNodeLinkDetails(lines, 'Node1');
  assert.deepStrictEqual(details, {
    url: 'https://test.io',
    tooltip: 'My Tooltip',
    target: '_self',
  });
});

test('nodeLinks: formatNodeLinkStatement produces standard Mermaid', () => {
  assert.equal(
    formatNodeLinkStatement('A', { url: 'https://example.com' }),
    'click A "https://example.com"'
  );
  assert.equal(
    formatNodeLinkStatement('A', { url: 'https://example.com', tooltip: 'tip', target: '_blank' }),
    'click A "https://example.com" "tip" _blank'
  );
  assert.equal(
    formatNodeLinkStatement('B', { url: 'https://class.io', tooltip: 'Class Tip' }, 'link'),
    'link B "https://class.io" "Class Tip"'
  );
  assert.equal(
    formatNodeLinkStatement('Actor1', { url: 'https://actor.org', tooltip: 'Profile' }, 'sequence'),
    'link Actor1: Profile @ https://actor.org'
  );
});

test('nodeLinks: updateNodeLinkInRawLines adds, updates, and deletes links', () => {
  const lines: Array<{ text: string }> = [
    { text: 'A --> B' },
  ];

  // 1. Add link
  updateNodeLinkInRawLines(lines, 'A', { url: 'https://a.com', tooltip: 'A Tip' }, 'click');
  assert.equal(lines.length, 2);
  assert.equal(lines[1].text, 'click A "https://a.com" "A Tip"');

  // 2. Update link
  updateNodeLinkInRawLines(lines, 'A', { url: 'https://new-a.com' }, 'click');
  assert.equal(lines.length, 2);
  assert.equal(lines[1].text, 'click A "https://new-a.com"');

  // 3. Delete link
  updateNodeLinkInRawLines(lines, 'A', null, 'click');
  assert.equal(lines.length, 1);
  assert.equal(lines[0].text, 'A --> B');
});
