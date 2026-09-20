import test from 'node:test';
import assert from 'node:assert';
import { getDriver } from '../src/diagrams/registry';

const driver = getDriver('stateDiagram')!;

function roundTrip(code: string): string {
  return driver.serialize(driver.parse(code));
}

test('State preservation: notes survive visual edits verbatim', () => {
  const code = [
    'stateDiagram-v2',
    '    [*] --> State1',
    '    State1 --> State2 : go',
    '    note right of State1 : This is a note',
    '    note left of State2 : Another note',
    '    State2 --> [*]',
    '',
  ].join('\n');

  const ast = driver.parse(code);
  // No junk states from the note keywords/positions
  assert.ok(!ast.states.has('right'));
  assert.ok(!ast.states.has('left'));
  assert.ok(!ast.states.has('of'));
  // The note text must not overwrite State1's label
  assert.strictEqual(ast.states.get('State1')!.label, 'State1');

  const out = roundTrip(code);
  assert.ok(out.includes('note right of State1 : This is a note'));
  assert.ok(out.includes('note left of State2 : Another note'));
  assert.ok(!out.includes('    right'));
  // Stable across repeated round-trips
  assert.strictEqual(roundTrip(out), out);
});

test('State preservation: classDef and class statements survive', () => {
  const code = [
    'stateDiagram-v2',
    '    [*] --> Still',
    '    Still --> Moving',
    '    classDef movement font-style:italic',
    '    classDef badEvent fill:#f00,color:white,font-weight:bold',
    '    class Still movement',
    '    class Moving, Still movement',
    '    Moving --> [*]',
    '',
  ].join('\n');

  const ast = driver.parse(code);
  assert.ok(!ast.states.has('classDef'));
  assert.ok(!ast.states.has('movement'));
  assert.ok(!ast.states.has('class'));
  assert.strictEqual(ast.states.size, 3); // [*], Still, Moving

  const out = roundTrip(code);
  assert.ok(out.includes('classDef movement font-style:italic'));
  assert.ok(out.includes('classDef badEvent fill:#f00,color:white,font-weight:bold'));
  assert.ok(out.includes('class Still movement'));
  assert.ok(out.includes('class Moving, Still movement'));
  assert.strictEqual(roundTrip(out), out);
});

test('State preservation: ::: inline class shorthand does not corrupt transitions', () => {
  const code = [
    'stateDiagram-v2',
    '    [*] --> S1',
    '    S2:::badBad --> S3 : crash',
    '    S1 --> S2',
    '    S3 --> [*]',
    '',
  ].join('\n');

  const ast = driver.parse(code);
  assert.ok(!ast.states.has('S2:::badBad'));
  // The modeled transitions are intact
  assert.ok(ast.transitions.some((t) => t.from === 'S1' && t.to === 'S2'));

  const out = roundTrip(code);
  assert.ok(out.includes('S2:::badBad --> S3 : crash'));
  assert.strictEqual(roundTrip(out), out);
});

test('State preservation: comments survive, including trailing comments', () => {
  const code = [
    'stateDiagram-v2',
    '    %% top-level comment',
    '    [*] --> Idle %% trailing comment',
    '    Idle --> Done : finish',
    '    Done --> [*]',
    '',
  ].join('\n');

  const out = roundTrip(code);
  assert.ok(out.includes('%% top-level comment'));
  assert.ok(out.includes('%% trailing comment'));
  assert.ok(out.includes('Idle --> Done : finish'));
  assert.strictEqual(roundTrip(out), out);
});

test('State preservation: -- concurrency separator stays inside its composite', () => {
  const code = [
    'stateDiagram-v2',
    '    [*] --> Active',
    '    state Active {',
    '        [*] --> NumLockOff',
    '        NumLockOff --> NumLockOn : EvNumLock',
    '        --',
    '        [*] --> CapsLockOff',
    '        CapsLockOff --> CapsLockOn : EvCapsLock',
    '    }',
    '    Active --> [*]',
    '',
  ].join('\n');

  const ast = driver.parse(code);
  assert.ok(!ast.states.has('--'), 'separator must not become a state');

  const out = roundTrip(code);
  const activeBlock = out.slice(out.indexOf('state Active {'), out.indexOf('}'));
  assert.ok(activeBlock.includes('--'), 'separator must stay inside the composite body');
  assert.strictEqual(roundTrip(out), out);
});

test('Composite transitions: parse without junk shadow states', () => {
  // Canonical mermaid doc pattern: initial transition into a composite
  const code = [
    'stateDiagram-v2',
    '    [*] --> Active',
    '    state Active {',
    '        [*] --> Idle',
    '        Idle --> Processing : run',
    '        Processing --> Idle : stop',
    '    }',
    '    Active --> Inactive : suspend',
    '    state Inactive {',
    '        [*] --> Sleeping',
    '    }',
    '    Inactive --> Active : resume',
    '    Active --> [*]',
    '',
  ].join('\n');

  const ast = driver.parse(code);
  // Composites exist
  assert.ok(ast.compositeStates.has('Active'));
  assert.ok(ast.compositeStates.has('Inactive'));
  // No shadow states with the composite ids
  assert.ok(!ast.states.has('Active'));
  assert.ok(!ast.states.has('Inactive'));
  // Composite transitions are modeled
  assert.ok(ast.transitions.some((t) => t.from === 'Active' && t.to === 'Inactive' && t.label === 'suspend'));
  assert.ok(ast.transitions.some((t) => t.from === 'Inactive' && t.to === 'Active' && t.label === 'resume'));
  assert.ok(ast.transitions.some((t) => t.from === '[*]' && t.to === 'Active'));
  assert.ok(ast.transitions.some((t) => t.from === 'Active' && t.to === '[*]'));

  const out = roundTrip(code);
  assert.ok(out.includes('Active --> Inactive : suspend'));
  assert.ok(out.includes('Inactive --> Active : resume'));
  assert.ok(out.includes('[*] --> Active'));
  assert.ok(out.includes('Active --> [*]'));
  assert.strictEqual(roundTrip(out), out);
});

test('Composite transitions: forward references reconcile to the composite', () => {
  // Transition line appears before the composite is declared
  const code = [
    'stateDiagram-v2',
    '    [*] --> Active',
    '    state Active {',
    '        [*] --> Idle',
    '        Idle --> Processing',
    '    }',
    '',
  ].join('\n');

  const ast = driver.parse(code);
  assert.ok(ast.compositeStates.has('Active'));
  assert.ok(!ast.states.has('Active'), 'implicit state must be reconciled away');
  assert.ok(ast.states.has('Idle'));
  assert.ok(ast.states.has('Processing'));

  const out = roundTrip(code);
  assert.ok(out.includes('[*] --> Active'));
  assert.strictEqual(roundTrip(out), out);
});

test('Composite transitions: project as selectable/reversible edges', () => {
  const code = [
    'stateDiagram-v2',
    '    [*] --> Active',
    '    state Active {',
    '        [*] --> Idle',
    '    }',
    '    Active --> Inactive : suspend',
    '',
  ].join('\n');

  const ast = driver.parse(code);
  const projection = driver.project(ast);
  const compEdge = projection.edges.find((e) => e.from === 'Active' && e.to === 'Inactive');
  assert.ok(compEdge, 'composite transition must appear in the view projection');
  assert.strictEqual(compEdge!.label, 'suspend');

  // Driver mutations work on composite endpoints
  const next = driver.clone(ast);
  driver.mutations.reverseEdge(next, compEdge!.id);
  assert.ok(next.transitions.some((t) => t.from === 'Inactive' && t.to === 'Active'));

  driver.mutations.connect(next, 'Inactive', 'Active');
  driver.mutations.updateEdgeLabel(next, compEdge!.id, 'renamed');
  driver.mutations.deleteEdge(next, compEdge!.id);
  assert.ok(!next.transitions.some((t) => t.label === 'suspend'));
});

test('Composite transitions: deleting a composite drops its endpoint transitions', () => {
  const code = [
    'stateDiagram-v2',
    '    [*] --> Active',
    '    state Active {',
    '        [*] --> Idle',
    '    }',
    '    Active --> Inactive : suspend',
    '    state Inactive {',
    '        [*] --> Sleeping',
    '    }',
    '',
  ].join('\n');

  const ast = driver.parse(code);
  driver.mutations.deleteGroup(ast, 'Inactive', false);
  assert.ok(!ast.transitions.some((t) => t.from === 'Active' && t.to === 'Inactive'));
  // Dissolve keeps inner states and the other composite untouched
  assert.ok(ast.states.has('Sleeping'));
  assert.ok(ast.compositeStates.has('Active'));
});

test('Composite transitions: connect via driver mutation', () => {
  const code = [
    'stateDiagram-v2',
    '    [*] --> Active',
    '    state Active {',
    '        [*] --> Idle',
    '    }',
    '    Failed : terminal',
    '',
  ].join('\n');

  const ast = driver.parse(code);
  driver.mutations.connect(ast, 'Active', 'Failed');
  const out = driver.serialize(ast);
  assert.ok(out.includes('Active --> Failed'));
  // Round-trips as a composite transition, not a shadow state
  const reparsed = driver.parse(out);
  assert.ok(reparsed.compositeStates.has('Active'));
  assert.ok(!reparsed.states.has('Active'));
});

test('State preservation: click interaction lines survive visual edits verbatim', () => {
  const code = [
    'stateDiagram-v2',
    '    [*] --> Idle',
    '    Idle --> Processing : Submit',
    '    click Idle href "https://example.com" "tip"',
    '',
  ].join('\n');

  const ast = driver.parse(code);
  // No junk states from the click statement
  assert.ok(!ast.states.has('click'));
  assert.ok(!ast.states.has('href'));
  assert.ok(!ast.states.has('https://example.com'));
  assert.ok(!ast.states.has('tip'));
  assert.strictEqual(ast.states.size, 3); // [*], Idle, Processing

  // Visual edit: sprout a child state off Idle
  driver.mutations.addChildNode(ast, 'Idle', 'Next State');
  const out = driver.serialize(ast);
  assert.ok(out.includes('click Idle href "https://example.com" "tip"'));
  assert.ok(!out.includes('    click\n'));
  // Stable across repeated round-trips
  assert.strictEqual(roundTrip(out), out);
});

test('State preservation: a state literally named click still works', () => {
  const code = [
    'stateDiagram-v2',
    '    click --> Idle',
    '    Idle --> [*]',
    '',
  ].join('\n');

  const ast = driver.parse(code);
  assert.ok(ast.states.has('click'), 'state named click must still parse');
  assert.strictEqual(ast.transitions.length, 2);
  assert.strictEqual(ast.rawLines.length, 0);
});
