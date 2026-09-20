import test from 'node:test';
import assert from 'node:assert';
import { getDriver, detectDiagramType } from '../src/diagrams/registry';
import { connectStates, areInDifferentComposites } from '../src/diagrams/state/mutations/transitionMutations';

const driver = getDriver('stateDiagram')!;

function roundTrip(code: string): string {
  return driver.serialize(driver.parse(code));
}

test('Official Docs: YAML Frontmatter and Header Detection', () => {
  const code = [
    '---',
    'title: Simple sample',
    'config:',
    '  theme: default',
    '  look: classic',
    '---',
    'stateDiagram-v2',
    '    [*] --> Still',
    '    Still --> [*]',
    '    Still --> Moving',
    '    Moving --> Still',
    '    Moving --> Crash',
    '    Crash --> [*]',
  ].join('\n');

  // Must detect as stateDiagram even with frontmatter
  assert.strictEqual(detectDiagramType(code), 'stateDiagram');
  assert.ok(driver.canHandle(code));

  const ast = driver.parse(code);
  assert.ok(ast.frontmatter);
  assert.ok(ast.frontmatter.includes('title: Simple sample'));
  assert.ok(ast.frontmatter.includes('look: classic'));
  assert.strictEqual(ast.diagramType, 'stateDiagram-v2');

  // Must not have generated fake states from frontmatter lines
  assert.ok(!ast.states.has('---'));
  assert.ok(!ast.states.has('title'));
  assert.ok(!ast.states.has('config'));
  assert.ok(!ast.states.has('theme'));
  assert.ok(!ast.states.has('look'));
  assert.strictEqual(ast.states.size, 4); // [*], Still, Moving, Crash

  const out = roundTrip(code);
  assert.ok(out.startsWith('---\n'));
  assert.ok(out.includes('title: Simple sample'));
  assert.ok(out.includes('look: classic'));
  assert.ok(out.includes('stateDiagram-v2'));
  assert.ok(out.includes('Still --> Moving'));
});

test('Official Docs: Older Renderer Header (stateDiagram)', () => {
  const code = [
    'stateDiagram',
    '    [*] --> Still',
    '    Still --> [*]',
  ].join('\n');

  assert.strictEqual(detectDiagramType(code), 'stateDiagram');
  assert.ok(driver.canHandle(code));

  const ast = driver.parse(code);
  assert.strictEqual(ast.diagramType, 'stateDiagram');
  const out = roundTrip(code);
  assert.ok(out.startsWith('stateDiagram\n'));
});

test('Official Docs: Accessibility Directives (accTitle & accDescr)', () => {
  const code = [
    'stateDiagram',
    '    direction TB',
    '    accTitle: This is the accessible title',
    '    accDescr: This is an accessible description',
    '    [*] --> Still',
    '    Still --> [*]',
  ].join('\n');

  const ast = driver.parse(code);
  // accTitle and accDescr must NOT become fake states
  assert.ok(!ast.states.has('accTitle'));
  assert.ok(!ast.states.has('accDescr'));
  assert.strictEqual(ast.states.size, 2); // [*], Still

  const out = roundTrip(code);
  assert.ok(out.includes('accTitle: This is the accessible title'));
  assert.ok(out.includes('accDescr: This is an accessible description'));
  assert.ok(!out.includes('state "This is the accessible title"'));
  assert.strictEqual(roundTrip(out), out);
});

test('Official Docs: Multi-line accDescr block', () => {
  const code = [
    'stateDiagram-v2',
    '    accDescr {',
    '        Line 1 of description',
    '        Line 2 of description',
    '    }',
    '    [*] --> S1',
    '    S1 --> [*]',
  ].join('\n');

  const ast = driver.parse(code);
  assert.ok(!ast.states.has('accDescr'));
  assert.ok(!ast.states.has('Line'));
  assert.ok(!ast.states.has('1'));

  const out = roundTrip(code);
  assert.ok(out.includes('accDescr {'));
  assert.ok(out.includes('Line 1 of description'));
  assert.ok(out.includes('}'));
  assert.strictEqual(roundTrip(out), out);
});

test('Official Docs: States and Descriptions (3 forms)', () => {
  // Form 1: stateId
  // Form 2: state "desc" as s2
  // Form 3: s2 : desc
  const code = [
    'stateDiagram-v2',
    '    s1',
    '    state "This is a state description" as s2',
    '    s3 : Another state description',
    '    s1 --> s2',
    '    s2 --> s3',
  ].join('\n');

  const ast = driver.parse(code);
  assert.strictEqual(ast.states.get('s1')!.label, 's1');
  assert.strictEqual(ast.states.get('s2')!.label, 'This is a state description');
  assert.strictEqual(ast.states.get('s3')!.label, 'Another state description');

  const out = roundTrip(code);
  assert.ok(out.includes('state "This is a state description" as s2'));
  assert.ok(out.includes('state "Another state description" as s3'));
  assert.ok(out.includes('s1 --> s2'));
  assert.ok(out.includes('s2 --> s3'));
});

test('Official Docs: Transitions with and without colon labels', () => {
  const code = [
    'stateDiagram-v2',
    '    s1 --> s2',
    '    s1 --> s2: A transition',
    '    s2 --> s3 : Another transition',
  ].join('\n');

  const ast = driver.parse(code);
  assert.strictEqual(ast.transitions.length, 3);
  assert.strictEqual(ast.transitions[0].label, undefined);
  assert.strictEqual(ast.transitions[1].label, 'A transition');
  assert.strictEqual(ast.transitions[2].label, 'Another transition');

  const out = roundTrip(code);
  assert.ok(out.includes('s1 --> s2\n'));
  assert.ok(out.includes('s1 --> s2 : A transition'));
  assert.ok(out.includes('s2 --> s3 : Another transition'));
});

test('Official Docs: Composite states with external label declaration', () => {
  const code = [
    'stateDiagram-v2',
    '    [*] --> First',
    '    state First {',
    '        [*] --> second',
    '        second --> [*]',
    '    }',
    '    [*] --> NamedComposite',
    '    NamedComposite: Another Composite',
    '    state NamedComposite {',
    '        [*] --> namedSimple',
    '        namedSimple --> [*]',
    '        namedSimple: Another simple',
    '    }',
  ].join('\n');

  const ast = driver.parse(code);
  assert.ok(ast.compositeStates.has('First'));
  assert.ok(ast.compositeStates.has('NamedComposite'));
  assert.strictEqual(ast.compositeStates.get('NamedComposite')!.label, 'Another Composite');
  assert.strictEqual(ast.states.get('namedSimple')!.label, 'Another simple');

  const out = roundTrip(code);
  assert.ok(out.includes('state "Another Composite" as NamedComposite {'));
  assert.ok(out.includes('state "Another simple" as namedSimple'));
});

test('Official Docs: Multidimensional layered composites', () => {
  const code = [
    'stateDiagram-v2',
    '    [*] --> First',
    '    state First {',
    '        [*] --> Second',
    '        state Second {',
    '            [*] --> second',
    '            second --> Third',
    '            state Third {',
    '                [*] --> third',
    '                third --> [*]',
    '            }',
    '        }',
    '    }',
  ].join('\n');

  const ast = driver.parse(code);
  assert.ok(ast.compositeStates.has('First'));
  assert.ok(ast.compositeStates.has('Second'));
  assert.ok(ast.compositeStates.has('Third'));
  assert.deepStrictEqual(ast.compositeStates.get('First')!.compositeIds, ['Second']);
  assert.deepStrictEqual(ast.compositeStates.get('Second')!.compositeIds, ['Third']);

  const out = roundTrip(code);
  assert.ok(out.includes('state First {'));
  assert.ok(out.includes('state Second {'));
  assert.ok(out.includes('state Third {'));
});

test('Official Docs: Transitions between composite states', () => {
  const code = [
    'stateDiagram-v2',
    '    [*] --> First',
    '    First --> Second',
    '    First --> Third',
    '    state First {',
    '        [*] --> fir',
    '        fir --> [*]',
    '    }',
    '    state Second {',
    '        [*] --> sec',
    '        sec --> [*]',
    '    }',
    '    state Third {',
    '        [*] --> thi',
    '        thi --> [*]',
    '    }',
  ].join('\n');

  const ast = driver.parse(code);
  assert.ok(ast.transitions.some((t) => t.from === 'First' && t.to === 'Second'));
  assert.ok(ast.transitions.some((t) => t.from === 'First' && t.to === 'Third'));

  const out = roundTrip(code);
  assert.ok(out.includes('First --> Second'));
  assert.ok(out.includes('First --> Third'));
});

test('Official Rule: Cannot define transitions between internal states belonging to different composite states', () => {
  const code = [
    'stateDiagram-v2',
    '    state Comp1 {',
    '        [*] --> s1',
    '        s1 --> [*]',
    '    }',
    '    state Comp2 {',
    '        [*] --> s2',
    '        s2 --> [*]',
    '    }',
  ].join('\n');

  const ast = driver.parse(code);
  assert.ok(areInDifferentComposites(ast, 's1', 's2'));
  assert.ok(areInDifferentComposites(ast, 's2', 's1'));

  // Connection between s1 and s2 must be rejected
  const res = connectStates(ast, 's1', 's2');
  assert.strictEqual(res, null, 'transition between internal states of different composites must be blocked');

  // But connecting outer node or composite to composite is permitted
  const validTr = connectStates(ast, 'Comp1', 'Comp2');
  assert.ok(validTr, 'transitions between composite states are permitted');
});

test('Official Docs: Choice stereotype <<choice>> with branching', () => {
  const code = [
    'stateDiagram-v2',
    '    state if_state <<choice>>',
    '    [*] --> IsPositive',
    '    IsPositive --> if_state',
    '    if_state --> False: if n < 0',
    '    if_state --> True : if n >= 0',
  ].join('\n');

  const ast = driver.parse(code);
  assert.strictEqual(ast.states.get('if_state')!.stateType, 'choice');

  const out = roundTrip(code);
  assert.ok(out.includes('state if_state <<choice>>'));
  assert.ok(out.includes('if_state --> False : if n < 0'));
  assert.ok(out.includes('if_state --> True : if n >= 0'));
});

test('Official Docs: Forks and Joins <<fork>> <<join>>', () => {
  const code = [
    'stateDiagram-v2',
    '    state fork_state <<fork>>',
    '    [*] --> fork_state',
    '    fork_state --> State2',
    '    fork_state --> State3',
    '    state join_state <<join>>',
    '    State2 --> join_state',
    '    State3 --> join_state',
    '    join_state --> State4',
    '    State4 --> [*]',
  ].join('\n');

  const ast = driver.parse(code);
  assert.strictEqual(ast.states.get('fork_state')!.stateType, 'fork');
  assert.strictEqual(ast.states.get('join_state')!.stateType, 'join');

  const out = roundTrip(code);
  assert.ok(out.includes('state fork_state <<fork>>'));
  assert.ok(out.includes('state join_state <<join>>'));
});

test('Official Docs: Concurrency divider (--) stays between concurrent regions', () => {
  const code = [
    'stateDiagram-v2',
    '    [*] --> Active',
    '    state Active {',
    '        [*] --> NumLockOff',
    '        NumLockOff --> NumLockOn : EvNumLockPressed',
    '        --',
    '        [*] --> CapsLockOff',
    '        CapsLockOff --> CapsLockOn : EvCapsLockPressed',
    '        --',
    '        [*] --> ScrollLockOff',
    '        ScrollLockOff --> ScrollLockOn : EvScrollLockPressed',
    '    }',
  ].join('\n');

  const ast = driver.parse(code);
  const out = roundTrip(code);

  const numIdx = out.indexOf('NumLockOff --> NumLockOn');
  const firstDash = out.indexOf('\n        --\n');
  const capIdx = out.indexOf('CapsLockOff --> CapsLockOn');
  const secondDash = out.indexOf('\n        --\n', firstDash + 5);
  const scrollIdx = out.indexOf('ScrollLockOff --> ScrollLockOn');

  assert.ok(firstDash !== -1, 'First -- must be present');
  assert.ok(secondDash !== -1, 'Second -- must be present');
  assert.ok(numIdx < firstDash, 'NumLock transition must precede first --');
  assert.ok(firstDash < capIdx, 'First -- must precede CapsLock transition');
  assert.ok(capIdx < secondDash, 'CapsLock transition must precede second --');
  assert.ok(secondDash < scrollIdx, 'Second -- must precede ScrollLock transition');
});

test('Official Docs: Direction setting at diagram and composite levels', () => {
  const code = [
    'stateDiagram',
    '    direction LR',
    '    [*] --> A',
    '    A --> B',
    '    state B {',
    '        direction LR',
    '        a --> b',
    '    }',
  ].join('\n');

  const ast = driver.parse(code);
  assert.strictEqual(ast.direction, 'LR');
  assert.strictEqual(ast.compositeStates.get('B')!.direction, 'LR');

  const out = roundTrip(code);
  assert.ok(out.includes('    direction LR'));
  assert.ok(out.includes('        direction LR'));
});

test('Official Docs: classDef and class assignment styling', () => {
  const code = [
    'stateDiagram',
    '    direction TB',
    '    classDef notMoving fill:white',
    '    classDef movement font-style:italic',
    '    classDef badBadEvent fill:#f00,color:white,font-weight:bold,stroke-width:2px,stroke:yellow',
    '    [*] --> Still',
    '    Still --> Moving',
    '    Moving --> Crash',
    '    class Still notMoving',
    '    class Moving, Crash movement',
    '    class Crash badBadEvent',
  ].join('\n');

  const out = roundTrip(code);
  assert.ok(out.includes('classDef notMoving fill:white'));
  assert.ok(out.includes('classDef movement font-style:italic'));
  assert.ok(out.includes('classDef badBadEvent fill:#f00,color:white,font-weight:bold,stroke-width:2px,stroke:yellow'));
  assert.ok(out.includes('class Still notMoving'));
  assert.ok(out.includes('class Moving, Crash movement'));
  assert.ok(out.includes('class Crash badBadEvent'));
});

test('Official Docs: Spaces in state names with alias and reference', () => {
  const code = [
    'stateDiagram',
    '    yswsii: Your state with spaces in it',
    '    [*] --> yswsii',
    '    yswsii --> YetAnotherState',
    '    YetAnotherState --> [*]',
  ].join('\n');

  const ast = driver.parse(code);
  assert.strictEqual(ast.states.get('yswsii')!.label, 'Your state with spaces in it');

  const out = roundTrip(code);
  assert.ok(out.includes('state "Your state with spaces in it" as yswsii'));
  assert.ok(out.includes('[*] --> yswsii'));
  assert.ok(out.includes('yswsii --> YetAnotherState'));
});
