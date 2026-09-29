import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMermaidSequenceDiagram } from '../src/diagrams/sequence/parser';
import { serializeMermaidSequenceDiagram } from '../src/diagrams/sequence/serializer';
import { wrapMessagesInFrame } from '../src/diagrams/sequence/mutations/frameMutations';

test('Sequence Frames: wraps a single message in a loop block', () => {
  const code = `sequenceDiagram
    Alice->>Bob: Hello Bob
    Bob-->>Alice: Hi Alice
`;
  const ast = parseMermaidSequenceDiagram(code);
  const msgId = ast.messages[0].id;

  const result = wrapMessagesInFrame(ast, [msgId], {
    type: 'loop',
    label: 'Every 5 seconds',
  });

  assert.equal(result, true);
  const serialized = serializeMermaidSequenceDiagram(ast);

  assert.match(serialized, /loop Every 5 seconds/);
  assert.match(serialized, /Alice->>Bob: Hello Bob/);
  assert.match(serialized, /end/);
  // Ensure the second message is after the loop end
  const loopEndIdx = serialized.indexOf('end');
  const secondMsgIdx = serialized.indexOf('Bob-->>Alice');
  assert.ok(secondMsgIdx > loopEndIdx);
});

test('Sequence Frames: wraps multiple messages in an alt block', () => {
  const code = `sequenceDiagram
    Alice->>Bob: Query
    Bob->>DB: Select
    DB-->>Bob: Rows
    Bob-->>Alice: Result
`;
  const ast = parseMermaidSequenceDiagram(code);
  const msgIds = [ast.messages[1].id, ast.messages[2].id];

  const result = wrapMessagesInFrame(ast, msgIds, {
    type: 'alt',
    label: 'is cached',
  });

  assert.equal(result, true);
  const serialized = serializeMermaidSequenceDiagram(ast);

  assert.match(serialized, /alt is cached/);
  assert.match(serialized, /Bob->>DB: Select/);
  assert.match(serialized, /DB-->>Bob: Rows/);
  assert.match(serialized, /end/);
});

test('Sequence Frames: wraps messages in a rect color block', () => {
  const code = `sequenceDiagram
    Alice->>Bob: Critical Request
    Bob-->>Alice: Response
`;
  const ast = parseMermaidSequenceDiagram(code);
  const msgIds = [ast.messages[0].id, ast.messages[1].id];

  const result = wrapMessagesInFrame(ast, msgIds, {
    type: 'rect',
    label: 'rgb(200, 220, 255)',
  });

  assert.equal(result, true);
  const serialized = serializeMermaidSequenceDiagram(ast);

  assert.match(serialized, /rect rgb\(200, 220, 255\)/);
  assert.match(serialized, /end/);
});
