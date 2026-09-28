import test from 'node:test';
import assert from 'node:assert/strict';

import { getDriver, detectDiagramType } from '../src/diagrams/registry';
import { generateUniqueNodeId } from '../src/diagrams/flowchart/mutations/nodeMutations';
import { generateStateId } from '../src/diagrams/state/mutations/stateMutations';
import { generateParticipantId } from '../src/diagrams/sequence/mutations/participantMutations';
import { parseMermaidFlowchart } from '../src/diagrams/flowchart/parser';
import {
  splitFrontmatter,
  findFirstCodeLine,
  generateUniqueId,
} from '../src/diagrams/common/diagramHeader';

const flowchartDriver = getDriver('flowchart')!;
const stateDriver = getDriver('stateDiagram')!;
const sequenceDriver = getDriver('sequenceDiagram')!;

// ---------------------------------------------------------------------------
// Phase 0 characterization: frontmatter + header detection + ID generation.
// No production code changes here — these tests lock CURRENT behavior so
// Phase 1 extraction cannot regress. Known flowchart gaps are asserted as
// current (buggy) behavior and marked KNOWN BUG; PR1 will flip them.
// ---------------------------------------------------------------------------

const STATE_FM = [
  '---',
  'title: Simple sample',
  'config:',
  '  theme: default',
  '---',
  'stateDiagram-v2',
  '    [*] --> Still',
  '    Still --> [*]',
].join('\n');

const SEQUENCE_FM = [
  '---',
  'title: Authentication Sequence',
  '---',
  'sequenceDiagram',
  '    autonumber',
  '    Alice->>Bob: Request',
  '    Bob-->>Alice: Response',
].join('\n');

const FLOWCHART_FM = [
  '---',
  'title: Hello',
  '---',
  'flowchart TD',
  '    A --> B',
].join('\n');

test('Phase 0: state frontmatter survives parse → serialize verbatim', () => {
  const ast = stateDriver.parse(STATE_FM) as unknown as { frontmatter?: string };
  assert.ok(ast.frontmatter, 'state keeps frontmatter');
  assert.ok(ast.frontmatter.includes('title: Simple sample'));

  const out = stateDriver.serialize(ast);
  assert.ok(out.startsWith('---\n'), 'frontmatter emitted first');
  assert.ok(out.includes('title: Simple sample'));

  // Idempotent: second round-trip is stable
  const reparsed = stateDriver.parse(out);
  assert.strictEqual(stateDriver.serialize(reparsed), out);
});

test('Phase 0: state frontmatter survives a visual edit (addNode)', () => {
  const ast = stateDriver.parse(STATE_FM);
  stateDriver.mutations.addNode(ast, 'New State');
  const out = stateDriver.serialize(ast);
  assert.ok(out.startsWith('---\n'));
  assert.ok(out.includes('title: Simple sample'));
  // No bogus states from frontmatter lines
  const reparsed = stateDriver.parse(out);
  assert.ok(!reparsed.states.has('title'));
  assert.ok(!reparsed.states.has('config'));
});

test('Phase 0: sequence frontmatter survives parse → serialize verbatim', () => {
  const ast = sequenceDriver.parse(SEQUENCE_FM) as unknown as { frontmatter?: string };
  assert.ok(ast.frontmatter, 'sequence keeps frontmatter');
  assert.ok(ast.frontmatter.includes('Authentication Sequence'));

  const out = sequenceDriver.serialize(ast);
  assert.ok(out.startsWith('---\n'));
  assert.ok(out.includes('Authentication Sequence'));

  const reparsed = sequenceDriver.parse(out);
  assert.strictEqual(sequenceDriver.serialize(reparsed), out);
});

test('Phase 0: sequence frontmatter survives a visual edit (addNode)', () => {
  const ast = sequenceDriver.parse(SEQUENCE_FM);
  sequenceDriver.mutations.addNode(ast, 'New Participant');
  const out = sequenceDriver.serialize(ast);
  assert.ok(out.startsWith('---\n'));
  assert.ok(out.includes('Authentication Sequence'));
});

test('Phase 1: flowchart frontmatter survives parse → serialize verbatim', () => {
  // Fixed via shared splitFrontmatter/emitFrontmatter (same as state/sequence).
  const ast = parseMermaidFlowchart(FLOWCHART_FM);
  assert.ok(!ast.nodes.has('title:'), 'no bogus node from frontmatter');
  assert.ok(!ast.nodes.has('Hello'), 'no bogus node from frontmatter value');
  assert.ok(ast.nodes.has('A'));
  assert.ok(ast.nodes.has('B'));

  const out = flowchartDriver.serialize(ast);
  assert.ok(out.startsWith('---\n'), 'frontmatter emitted first');
  assert.ok(out.includes('title: Hello'));

  // Idempotent: second round-trip is stable
  const reparsed = flowchartDriver.parse(out);
  assert.strictEqual(flowchartDriver.serialize(reparsed), out);
});

test('Phase 1: flowchart frontmatter survives a visual edit (addNode)', () => {
  const ast = flowchartDriver.parse(FLOWCHART_FM);
  flowchartDriver.mutations.addNode(ast, 'New Step');
  const out = flowchartDriver.serialize(ast);
  assert.ok(out.startsWith('---\n'));
  assert.ok(out.includes('title: Hello'));
  const reparsed = flowchartDriver.parse(out);
  assert.ok(!reparsed.nodes.has('title:'));
});

test('Phase 0: detectDiagramType skips frontmatter/comments for all 3 diagrams', () => {
  assert.strictEqual(detectDiagramType(STATE_FM), 'stateDiagram');
  assert.strictEqual(detectDiagramType(SEQUENCE_FM), 'sequenceDiagram');
  assert.strictEqual(detectDiagramType(FLOWCHART_FM), 'flowchart');
  assert.strictEqual(detectDiagramType('%% comment\nflowchart LR\n  A --> B'), 'flowchart');
  assert.strictEqual(
    detectDiagramType('%% comment\nstateDiagram-v2\n  [*] --> S1'),
    'stateDiagram'
  );
  assert.strictEqual(
    detectDiagramType('%% comment\nsequenceDiagram\n  Alice->>Bob: Hi'),
    'sequenceDiagram'
  );
});

test('Phase 0: canHandle matrix — all 3 drivers skip frontmatter/comments', () => {
  // Plain + comment-prefixed: all three accept
  assert.ok(stateDriver.canHandle('stateDiagram-v2\n  [*] --> S1'));
  assert.ok(stateDriver.canHandle('%% c\nstateDiagram-v2\n  [*] --> S1'));
  assert.ok(sequenceDriver.canHandle('sequenceDiagram\n  Alice->>Bob: Hi'));
  assert.ok(sequenceDriver.canHandle('%% c\nsequenceDiagram\n  Alice->>Bob: Hi'));
  assert.ok(flowchartDriver.canHandle('flowchart TD\n  A --> B'));
  assert.ok(flowchartDriver.canHandle('graph LR\n  A --> B'));

  // Frontmatter-prefixed: all three accept (flowchart fixed in Phase 1)
  assert.ok(stateDriver.canHandle(STATE_FM));
  assert.ok(sequenceDriver.canHandle(SEQUENCE_FM));
  assert.ok(flowchartDriver.canHandle(FLOWCHART_FM));

  // Case-insensitivity + surrounding whitespace
  assert.ok(stateDriver.canHandle('  STATEDIAGRAM-V2\n  [*] --> S1'));
  assert.ok(sequenceDriver.canHandle('  SEQUENCEDIAGRAM\n  Alice->>Bob: Hi'));
  assert.ok(flowchartDriver.canHandle('  FLOWCHART TD\n  A --> B'));

  // Negative: wrong diagram, empty, comments-only
  assert.ok(!stateDriver.canHandle('flowchart TD\n  A --> B'));
  assert.ok(!sequenceDriver.canHandle('flowchart TD\n  A --> B'));
  assert.ok(!flowchartDriver.canHandle('stateDiagram-v2\n  [*] --> S1'));
  assert.ok(!flowchartDriver.canHandle(''));
  assert.ok(!stateDriver.canHandle('%% only comments\n%% here'));
});

test('Phase 0: ID generators never collide with existing ids', () => {
  // Flowchart: deterministic base_counter scheme
  const fcAst = flowchartDriver.parse('flowchart TD\n  A --> B\n');
  const fcIds = new Set<string>();
  for (let i = 0; i < 50; i++) {
    const id = generateUniqueNodeId(fcAst, 'step');
    assert.ok(!fcAst.nodes.has(id), `no collision: ${id}`);
    assert.ok(!fcIds.has(id), `unique across batch: ${id}`);
    assert.ok(id.startsWith('step_'));
    fcIds.add(id);
    fcAst.nodes.set(id, { type: 'node', id, label: id, shape: 'rectangle' });
  }

  // State: timestamped scheme, avoids states + composites
  const stAst = stateDriver.parse('stateDiagram-v2\n  [*] --> Idle\n');
  const stIds = new Set<string>();
  for (let i = 0; i < 50; i++) {
    const id = generateStateId('s', stAst);
    assert.ok(!stAst.states.has(id));
    assert.ok(!stAst.compositeStates.has(id));
    assert.ok(!stIds.has(id), `unique across batch: ${id}`);
    assert.ok(id.startsWith('s_'));
    stIds.add(id);
    stAst.states.set(id, { type: 'state', id, label: id, stateType: 'normal' });
  }

  // Sequence: timestamped scheme, avoids participants + boxes
  const seqAst = sequenceDriver.parse('sequenceDiagram\n  Alice->>Bob: Hi\n');
  const seqIds = new Set<string>();
  for (let i = 0; i < 50; i++) {
    const id = generateParticipantId('p', seqAst);
    assert.ok(!seqAst.participants.has(id));
    assert.ok(!seqAst.boxes.has(id));
    assert.ok(!seqIds.has(id), `unique across batch: ${id}`);
    assert.ok(id.startsWith('p_'));
    seqIds.add(id);
    seqAst.participants.set(id, {
      type: 'participant',
      id,
      label: id,
      kind: 'participant',
      order: seqAst.participants.size,
      explicit: true,
    });
  }
});

test('Phase 1: shared header helpers handle edge cases safely', () => {
  // Comment before frontmatter: frontmatter still found, comment kept in body
  const withComment = '%% a comment\n---\ntitle: Hi\n---\nflowchart TD\n  A --> B';
  const split = splitFrontmatter(withComment);
  assert.ok(split.frontmatter?.includes('title: Hi'));
  assert.ok(split.body.includes('%% a comment'));
  assert.strictEqual(findFirstCodeLine(withComment), 'flowchart TD');

  // Unclosed frontmatter is NOT treated as frontmatter (never swallow diagram)
  const unclosed = '---\ntitle: Hi\nflowchart TD\n  A --> B';
  assert.strictEqual(splitFrontmatter(unclosed).frontmatter, undefined);
  assert.strictEqual(findFirstCodeLine(unclosed), '---');

  // --- after real code is content, not frontmatter
  const lateDashes = 'flowchart TD\n  A --> B\n---\nnot frontmatter';
  assert.strictEqual(splitFrontmatter(lateDashes).frontmatter, undefined);
  assert.strictEqual(findFirstCodeLine(lateDashes), 'flowchart TD');

  // Comments-only / empty have no code line
  assert.strictEqual(findFirstCodeLine('%% only\n%% comments'), undefined);
  assert.strictEqual(findFirstCodeLine(''), undefined);

  // Shared ID helper matches flowchart behavior: deterministic, no collisions
  const existing = new Set(['step_1', 'step_2']);
  assert.strictEqual(generateUniqueId(existing, 'step'), 'step_3');
  // Counter starts at size+1 then skips taken ids (no gap backfill by design)
  assert.strictEqual(
    generateUniqueId(new Set(['p_1', 'p_3']), 'p'),
    'p_4'
  );
});

test('Mermaid Directives: multi-line %%{init: ...}%% directive survives visual edits verbatim', () => {
  const userSnippet = [
    "%%{init: {'theme': 'dark', 'themeVariables': { 'darkMode': true, 'background': 'transparent',",
    "  'mainBkg': '#1e293b', 'primaryColor': '#1e293b', 'primaryBorderColor': '#3b82f6', 'primaryTextColor':",
    "  '#f8fafc', 'lineColor': '#38bdf8', 'edgeLabelBackground': '#1e293b' }}}%%",
    '    flowchart TD',
    '        subgraph Gaps ["⚠ Identified Critical Gaps"]',
    '            G1["1. Embedding Engine Choice\\nTorch vs Lightweight ONNX"]',
    '            G2["2. Chunking & Breadcrumbs\\nNaive ## vs Heading Path Hierarchy"]',
    '            G3["3. Dual-Store Incremental Sync\\nKeeping LadybugDB & LanceDB in Lockstep"]',
    '            G4["4. Graph-to-Chunk Boost Math\\nNote-level hops → Chunk-level scoring"]',
    '            G5["5. Search Modes & Fallback\\nDense vs Sparse vs Hybrid toggling"]',
    '        end',
    '',
    '        Gaps --> Solution["🎯 Refined Phase 2 Architecture"]',
    '        style Solution fill:#14532d,stroke:#22c55e,color:#e2e8f0',
  ].join('\n');

  // 1. Detection
  assert.strictEqual(detectDiagramType(userSnippet), 'flowchart');

  // 2. Driver parse
  const ast = flowchartDriver.parse(userSnippet);
  assert.strictEqual(ast.diagramType, 'flowchart');
  assert.strictEqual(ast.direction, 'TD');

  // 3. Verify no bogus nodes from directive
  assert.ok(!ast.nodes.has("'mainBkg':"));
  assert.ok(!ast.nodes.has('mainBkg'));
  assert.ok(!ast.nodes.has('primaryColor'));
  assert.ok(ast.nodes.has('G1'));
  assert.ok(ast.nodes.has('G5'));
  assert.ok(ast.nodes.has('Solution'));

  // 4. Verify directives stored
  assert.ok(ast.directives && ast.directives.length === 1);
  assert.ok(ast.directives[0].includes('themeVariables'));

  // 5. Serialize: directive is emitted at the top
  const serialized = flowchartDriver.serialize(ast);
  assert.ok(serialized.startsWith('%%{init:'));
  assert.ok(serialized.includes("'mainBkg': '#1e293b'"));
  assert.ok(serialized.includes('flowchart TD'));

  // 6. Visual edit (addNode)
  flowchartDriver.mutations.addNode(ast, 'New Phase');
  const edited = flowchartDriver.serialize(ast);
  assert.ok(edited.startsWith('%%{init:'));
  assert.ok(edited.includes('New Phase'));

  // 7. Idempotent round-trip
  const reparsed = flowchartDriver.parse(edited);
  assert.strictEqual(flowchartDriver.serialize(reparsed), edited);
});

test('Mermaid Directives: single-line and multi-line directives across diagram types', () => {
  // State diagram with directive
  const stateCode = "%%{init: {'theme': 'dark'}}%%\nstateDiagram-v2\n    [*] --> S1\n    S1 --> [*]";
  assert.strictEqual(detectDiagramType(stateCode), 'stateDiagram');
  const stateAst = stateDriver.parse(stateCode);
  assert.ok(stateAst.directives && stateAst.directives.length === 1);
  const stateOut = stateDriver.serialize(stateAst);
  assert.ok(stateOut.startsWith("%%{init: {'theme': 'dark'}}%%\nstateDiagram-v2"));

  // Sequence diagram with directive
  const seqCode = "%%{init: {'theme': 'forest'}}%%\nsequenceDiagram\n    Alice->>Bob: Hello";
  assert.strictEqual(detectDiagramType(seqCode), 'sequenceDiagram');
  const seqAst = sequenceDriver.parse(seqCode);
  const seqOut = sequenceDriver.serialize(seqAst);
  assert.ok(seqOut.startsWith("%%{init: {'theme': 'forest'}}%%\nsequenceDiagram"));

  // Directive + frontmatter combination
  const combo = "---\ntitle: Flow\n---\n%%{init: {'theme': 'neutral'}}%%\nflowchart LR\n    A --> B";
  assert.strictEqual(detectDiagramType(combo), 'flowchart');
  const comboAst = flowchartDriver.parse(combo);
  assert.ok(comboAst.frontmatter?.includes('title: Flow'));
  assert.ok(comboAst.directives?.[0]?.includes('neutral'));
  const comboOut = flowchartDriver.serialize(comboAst);
  assert.ok(comboOut.startsWith('---\ntitle: Flow\n---\n%%{init:'));
});

