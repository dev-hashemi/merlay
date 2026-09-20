import test from 'node:test';
import assert from 'node:assert';
import { parseMermaidStateDiagram } from '../src/diagrams/state/parser';
import { serializeMermaidStateDiagram } from '../src/diagrams/state/serializer';

test('State AST: simple state diagram parse and serialize', () => {
  const code = `stateDiagram-v2
    direction LR
    [*] --> Idle
    Idle --> Processing : Submit
    Processing --> Success : Approve
    Processing --> Failed : Reject
    Success --> [*]
    Failed --> Idle : Retry`;

  const ast = parseMermaidStateDiagram(code);
  assert.strictEqual(ast.diagramType, 'stateDiagram-v2');
  assert.strictEqual(ast.direction, 'LR');
  assert.strictEqual(ast.states.has('Idle'), true);
  assert.strictEqual(ast.states.has('Processing'), true);
  assert.strictEqual(ast.states.has('Success'), true);
  assert.strictEqual(ast.states.has('Failed'), true);
  assert.strictEqual(ast.states.has('[*]'), true);
  assert.strictEqual(ast.transitions.length, 6);

  const serialized = serializeMermaidStateDiagram(ast);
  const ast2 = parseMermaidStateDiagram(serialized);
  assert.strictEqual(ast2.direction, 'LR');
  assert.strictEqual(ast2.transitions.length, 6);
  assert.strictEqual(ast2.states.size, ast.states.size);
});

test('State AST: pseudo-states choice, fork, and join', () => {
  const code = `stateDiagram-v2
    state is_valid <<choice>>
    state fork_branch <<fork>>
    state join_branch <<join>>
    [*] --> fork_branch
    fork_branch --> StateA
    fork_branch --> StateB
    StateA --> join_branch
    StateB --> join_branch
    join_branch --> is_valid
    is_valid --> Success : valid
    is_valid --> Failed : invalid`;

  const ast = parseMermaidStateDiagram(code);
  assert.strictEqual(ast.states.get('is_valid')?.stateType, 'choice');
  assert.strictEqual(ast.states.get('fork_branch')?.stateType, 'fork');
  assert.strictEqual(ast.states.get('join_branch')?.stateType, 'join');

  const serialized = serializeMermaidStateDiagram(ast);
  assert.match(serialized, /state is_valid <<choice>>/);
  assert.match(serialized, /state fork_branch <<fork>>/);
  assert.match(serialized, /state join_branch <<join>>/);
});

test('State AST: composite states', () => {
  const code = `stateDiagram-v2
    [*] --> Active
    state Active {
        direction TB
        Idle --> Running : Run
        Running --> Paused : Pause
        Paused --> Running : Resume
    }
    Active --> [*]`;

  const ast = parseMermaidStateDiagram(code);
  assert.strictEqual(ast.compositeStates.has('Active'), true);
  const comp = ast.compositeStates.get('Active')!;
  assert.strictEqual(comp.direction, 'TB');
  assert.deepStrictEqual(comp.stateIds.sort(), ['Idle', 'Paused', 'Running'].sort());

  const serialized = serializeMermaidStateDiagram(ast);
  assert.match(serialized, /state Active \{/);
  assert.match(serialized, /direction TB/);
});

test('State AST: descriptive state labels and aliases', () => {
  const code = `stateDiagram-v2
    state "Waiting For Input" as WaitState
    [*] --> WaitState
    WaitState --> Done : Complete
    Done --> [*]`;

  const ast = parseMermaidStateDiagram(code);
  assert.strictEqual(ast.states.get('WaitState')?.label, 'Waiting For Input');

  const serialized = serializeMermaidStateDiagram(ast);
  assert.match(serialized, /state "Waiting For Input" as WaitState/);
});

test('State AST: composite state with descriptive label and round-trip', () => {
  const code = `stateDiagram-v2
    state "Checkout Flow" as CheckoutComp {
        Cart
        Payment
        Cart --> Payment : Checkout
    }
    [*] --> CheckoutComp
    CheckoutComp --> [*]`;

  const ast = parseMermaidStateDiagram(code);
  assert.strictEqual(ast.compositeStates.has('CheckoutComp'), true);
  assert.strictEqual(ast.compositeStates.get('CheckoutComp')?.label, 'Checkout Flow');
  assert.strictEqual(ast.states.get('Cart')?.compositeId, 'CheckoutComp');
  assert.strictEqual(ast.states.get('Payment')?.compositeId, 'CheckoutComp');

  const serialized = serializeMermaidStateDiagram(ast);
  assert.match(serialized, /state "Checkout Flow" as CheckoutComp \{/);
  assert.match(serialized, /Cart/);
  assert.match(serialized, /Payment/);
  assert.match(serialized, /Cart --> Payment : Checkout/);

  const ast2 = parseMermaidStateDiagram(serialized);
  assert.strictEqual(ast2.compositeStates.get('CheckoutComp')?.label, 'Checkout Flow');
  assert.strictEqual(ast2.states.get('Cart')?.compositeId, 'CheckoutComp');
});
