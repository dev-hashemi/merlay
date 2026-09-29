import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMermaidFlowchart } from '../src/diagrams/flowchart/parser';
import { serializeMermaidFlowchart } from '../src/diagrams/flowchart/serializer';
import {
  getClassDefs,
  setClassDef,
  deleteClassDef,
  getNodeClasses,
  setNodeClasses,
  toggleNodeClass,
} from '../src/diagrams/flowchart/mutations/classDefMutations';

test('Flowchart classDef: parses existing classDef and class assignments', () => {
  const code = `flowchart TD
    A[Start] --> B[End]
    classDef success fill:#dcfce7,stroke:#16a34a
    class A success
`;
  const ast = parseMermaidFlowchart(code);

  const defs = getClassDefs(ast);
  assert.equal(defs.length, 1);
  assert.equal(defs[0].name, 'success');
  assert.equal(defs[0].styles.fill, '#dcfce7');
  assert.equal(defs[0].styles.stroke, '#16a34a');

  assert.deepEqual(getNodeClasses(ast, 'A'), ['success']);
  assert.deepEqual(getNodeClasses(ast, 'B'), []);
});

test('Flowchart classDef: adds a new classDef and applies to node', () => {
  const code = `flowchart TD
    A[Start] --> B[End]
`;
  const ast = parseMermaidFlowchart(code);

  setClassDef(ast, 'highlight', { fill: '#fef08a', stroke: '#eab308' });
  setNodeClasses(ast, 'B', ['highlight']);

  const serialized = serializeMermaidFlowchart(ast);
  assert.match(serialized, /classDef highlight fill:#fef08a,stroke:#eab308/);
  assert.match(serialized, /class B highlight/);

  // Toggle removes class
  toggleNodeClass(ast, 'B', 'highlight');
  assert.deepEqual(getNodeClasses(ast, 'B'), []);
  const serializedAfterToggle = serializeMermaidFlowchart(ast);
  assert.doesNotMatch(serializedAfterToggle, /class B highlight/);
});

test('Flowchart classDef: deleting classDef detaches from nodes', () => {
  const code = `flowchart TD
    A[Start] --> B[End]
    classDef danger fill:#fee2e2,stroke:#ef4444
    class A,B danger
`;
  const ast = parseMermaidFlowchart(code);
  assert.deepEqual(getNodeClasses(ast, 'A'), ['danger']);

  deleteClassDef(ast, 'danger');
  assert.equal(getClassDefs(ast).length, 0);
  assert.deepEqual(getNodeClasses(ast, 'A'), []);
  assert.deepEqual(getNodeClasses(ast, 'B'), []);

  const serialized = serializeMermaidFlowchart(ast);
  assert.doesNotMatch(serialized, /classDef danger/);
  assert.doesNotMatch(serialized, /class .* danger/);
});
