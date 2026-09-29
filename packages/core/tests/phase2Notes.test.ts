import test from 'node:test';
import assert from 'node:assert/strict';
import { SequenceDiagramDriver } from '../src/diagrams/sequence/sequenceDriver';
import { StateDiagramDriver } from '../src/diagrams/state/stateDriver';
import { ClassDiagramDriver } from '../src/diagrams/class/classDriver';

test('Phase 2: Sequence diagram notes mutation (add, edit position, delete)', () => {
  const driver = SequenceDiagramDriver;
  const ast = driver.parse('sequenceDiagram\n    Alice->>Bob: Hello\n');

  // 1. Initial state: no notes
  assert.deepEqual(driver.mutations.getNotes?.(ast, 'Bob'), []);

  // 2. Add note right of Bob
  driver.mutations.setNote?.(ast, 'Bob', {
    text: 'Bob is thinking',
    position: 'right',
  });

  const notes = driver.mutations.getNotes?.(ast, 'Bob');
  assert.equal(notes?.length, 1);
  assert.equal(notes?.[0].text, 'Bob is thinking');
  assert.equal(notes?.[0].position, 'right');

  let serialized = driver.serialize(ast);
  assert.ok(serialized.includes('Note right of Bob: Bob is thinking'));

  // 3. Edit position to over Alice,Bob
  driver.mutations.setNote?.(ast, 'Bob', {
    text: 'Both agree',
    position: 'over',
    secondTargetId: 'Alice',
  });

  serialized = driver.serialize(ast);
  assert.ok(serialized.includes('Note over Bob,Alice: Both agree'));
  assert.ok(!serialized.includes('Bob is thinking'));

  // 4. Delete note
  driver.mutations.setNote?.(ast, 'Bob', null);
  assert.deepEqual(driver.mutations.getNotes?.(ast, 'Bob'), []);
  serialized = driver.serialize(ast);
  assert.ok(!serialized.includes('Note over'));
});

test('Phase 2: State diagram notes mutation (add single, edit to multi-line, delete)', () => {
  const driver = StateDiagramDriver;
  const ast = driver.parse('stateDiagram-v2\n    [*] --> Idle\n    Idle --> Processing\n');

  // 1. Add single-line note
  assert.deepEqual(driver.mutations.getNotes?.(ast, 'Idle'), []);
  driver.mutations.setNote?.(ast, 'Idle', {
    text: 'Awaiting user input',
    position: 'right',
  });

  let notes = driver.mutations.getNotes?.(ast, 'Idle');
  assert.equal(notes?.length, 1);
  assert.equal(notes?.[0].text, 'Awaiting user input');
  assert.equal(notes?.[0].position, 'right');

  let serialized = driver.serialize(ast);
  assert.ok(serialized.includes('note right of Idle : Awaiting user input'));

  // 2. Edit to multi-line block on the left
  driver.mutations.setNote?.(ast, 'Idle', {
    text: 'Line 1: Reset timers\nLine 2: Flush buffer',
    position: 'left',
  });

  notes = driver.mutations.getNotes?.(ast, 'Idle');
  assert.equal(notes?.length, 1);
  assert.equal(notes?.[0].text, 'Line 1: Reset timers\nLine 2: Flush buffer');
  assert.equal(notes?.[0].position, 'left');

  serialized = driver.serialize(ast);
  assert.ok(serialized.includes('note left of Idle'));
  assert.ok(serialized.includes('Line 1: Reset timers'));
  assert.ok(serialized.includes('end note'));

  // 3. Delete note
  driver.mutations.setNote?.(ast, 'Idle', null);
  assert.deepEqual(driver.mutations.getNotes?.(ast, 'Idle'), []);
  serialized = driver.serialize(ast);
  assert.ok(!serialized.includes('note left of Idle'));
  assert.ok(!serialized.includes('Reset timers'));
});

test('Phase 2: Class diagram notes mutation (add class-bound, edit, delete)', () => {
  const driver = ClassDiagramDriver;
  const ast = driver.parse('classDiagram\n    class BankAccount {\n        +deposit()\n    }\n');

  // 1. Add class-bound note
  assert.deepEqual(driver.mutations.getNotes?.(ast, 'BankAccount'), []);
  driver.mutations.setNote?.(ast, 'BankAccount', {
    text: 'Core financial entity',
  });

  let notes = driver.mutations.getNotes?.(ast, 'BankAccount');
  assert.equal(notes?.length, 1);
  assert.equal(notes?.[0].text, 'Core financial entity');

  let serialized = driver.serialize(ast);
  assert.ok(serialized.includes('note for BankAccount "Core financial entity"'));

  // 2. Edit note text
  driver.mutations.setNote?.(ast, 'BankAccount', {
    text: 'Audited ledger balance',
  });

  notes = driver.mutations.getNotes?.(ast, 'BankAccount');
  assert.equal(notes?.[0].text, 'Audited ledger balance');

  serialized = driver.serialize(ast);
  assert.ok(serialized.includes('note for BankAccount "Audited ledger balance"'));
  assert.ok(!serialized.includes('Core financial entity'));

  // 3. Delete note
  driver.mutations.setNote?.(ast, 'BankAccount', null);
  assert.deepEqual(driver.mutations.getNotes?.(ast, 'BankAccount'), []);
  serialized = driver.serialize(ast);
  assert.ok(!serialized.includes('note for BankAccount'));
});
