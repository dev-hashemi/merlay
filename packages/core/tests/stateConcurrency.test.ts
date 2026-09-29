import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMermaidStateDiagram } from '../src/diagrams/state/parser';
import { serializeMermaidStateDiagram } from '../src/diagrams/state/serializer';
import {
  addConcurrencyDivider,
  removeConcurrencyDivider,
  getConcurrencyDividerCount,
} from '../src/diagrams/state/mutations/concurrencyMutations';

test('State Concurrency: adds divider to composite state and round-trips', () => {
  const code = `stateDiagram-v2
    state Active {
        [*] --> NumLockOff
        NumLockOff --> NumLockOn : EvNumLockPressed
    }
`;
  const ast = parseMermaidStateDiagram(code);
  assert.equal(getConcurrencyDividerCount(ast, 'Active'), 0);

  const added = addConcurrencyDivider(ast, 'Active');
  assert.equal(added, true);
  assert.equal(getConcurrencyDividerCount(ast, 'Active'), 1);

  const serialized = serializeMermaidStateDiagram(ast);
  assert.match(serialized, /^\s*--\s*$/m);

  // Parse serialized output and verify divider preservation
  const reast = parseMermaidStateDiagram(serialized);
  assert.equal(getConcurrencyDividerCount(reast, 'Active'), 1);
});

test('State Concurrency: removes divider from composite state', () => {
  const code = `stateDiagram-v2
    state Active {
        [*] --> NumLockOff
        --
        [*] --> CapsLockOff
    }
`;
  const ast = parseMermaidStateDiagram(code);
  assert.equal(getConcurrencyDividerCount(ast, 'Active'), 1);

  const removed = removeConcurrencyDivider(ast, 'Active');
  assert.equal(removed, true);
  assert.equal(getConcurrencyDividerCount(ast, 'Active'), 0);

  const serialized = serializeMermaidStateDiagram(ast);
  assert.doesNotMatch(serialized, /^\s*--\s*$/m);
});
