import test from 'node:test';
import assert from 'node:assert/strict';
import { getDriverForCode } from '../src/diagrams/registry';

const examples = [
  ['flowchart', 'flowchart LR\n  A[Start]\n  B[End]', 'A', 'B'],
  ['state', 'stateDiagram-v2\n  state A\n  state B', 'A', 'B'],
  ['class', 'classDiagram\n  class A\n  class B', 'A', 'B'],
  ['sequence', 'sequenceDiagram\n  participant A\n  participant B', 'A', 'B'],
  ['mindmap', 'mindmap\n  root((Root))\n    A[Branch]\n    B[Topic]', 'A', 'B'],
] as const;

for (const [name, code, from, to] of examples) {
  test(`${name}: connect returns the new projected edge that survives serialization`, () => {
    const driver = getDriverForCode(code);
    const ast = driver.parse(code);
    const before = driver.project(ast).edges.map((edge) => edge.id);
    const id = driver.mutations.connect(ast, from, to);
    assert.equal(typeof id, 'string');
    assert.equal(before.includes(id ?? ""), false);
    assert.deepEqual(driver.project(ast).edges.filter((edge) => edge.id === id)
      .map((edge) => [edge.from, edge.to]), [[from, to]]);
    const reparsed = driver.project(driver.parse(driver.serialize(ast)));
    assert.equal(reparsed.edges.filter((edge) => edge.from === from && edge.to === to).length, 1);
    if (name === 'mindmap') {
      assert.equal(reparsed.edges.some((edge) => edge.from === 'root' && edge.to === to), false);
    }
  });
}

test('a duplicate state transition does not report a newly added edge', () => {
  const driver = getDriverForCode('stateDiagram-v2\n  A --> B');
  const ast = driver.parse('stateDiagram-v2\n  A --> B');
  assert.equal(driver.mutations.connect(ast, 'A', 'B'), null);
  assert.equal(driver.project(ast).edges.length, 1);
});

test('inserting a repeated message after deletion does not reuse a surviving edge ID', () => {
  const code = 'sequenceDiagram\n  A->>B: Message\n  A->>B: Message';
  const driver = getDriverForCode(code);
  const ast = driver.parse(code);
  const [first, surviving] = driver.project(ast).edges;
  driver.mutations.deleteEdge(ast, first.id);
  const id = driver.mutations.connect(ast, 'A', 'B', { insertAtIndex: 0 });
  assert.equal(typeof id, 'string');
  assert.notEqual(id, surviving.id);
  assert.deepEqual(driver.project(ast).edges.map((edge) => edge.id), [id, surviving.id]);
});
