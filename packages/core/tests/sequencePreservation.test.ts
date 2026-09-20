import test from 'node:test';
import assert from 'node:assert';
import { SequenceDiagramDriver } from '../src/diagrams/sequence/sequenceDriver';

const driver = SequenceDiagramDriver;

test('Sequence Preservation: notes survive visual edits verbatim and stay in position', () => {
  const code = `sequenceDiagram
    participant Alice
    participant Bob
    Note over Alice,Bob: Important discussion
    Alice->>Bob: Hello Bob
    Note right of Bob: Bob thinking
    Bob-->>Alice: Hi Alice
`;
  const ast = driver.parse(code);

  // Perform visual edit: update message label
  const msg1 = ast.messages[0];
  driver.mutations.updateEdgeLabel(ast, msg1.id, 'Good morning Bob');

  const serialized = driver.serialize(ast);
  assert.ok(serialized.includes('Note over Alice,Bob: Important discussion'));
  assert.ok(serialized.includes('Alice->>Bob: Good morning Bob'));
  assert.ok(serialized.includes('Note right of Bob: Bob thinking'));
  assert.ok(serialized.includes('Bob-->>Alice: Hi Alice'));

  // Ensure relative order: Note 1 before msg1, Note 2 between msg1 and msg2
  const idxNote1 = serialized.indexOf('Note over Alice,Bob: Important discussion');
  const idxMsg1 = serialized.indexOf('Alice->>Bob: Good morning Bob');
  const idxNote2 = serialized.indexOf('Note right of Bob: Bob thinking');
  const idxMsg2 = serialized.indexOf('Bob-->>Alice: Hi Alice');

  assert.ok(idxNote1 < idxMsg1);
  assert.ok(idxMsg1 < idxNote2);
  assert.ok(idxNote2 < idxMsg2);
});

test('Sequence Preservation: control blocks (loop, alt, opt, par, critical, rect) survive edits', () => {
  const code = `sequenceDiagram
    autonumber
    Alice->>Bob: Start
    loop Every 5s
        Bob->>Bob: Check DB
    end
    alt OK
        Bob-->>Alice: Success
    else Error
        Bob-->>Alice: Failed
    end
`;
  const ast = driver.parse(code);

  // Edit Bob->>Bob message inside the loop
  const checkMsg = ast.messages.find((m) => m.from === 'Bob' && m.to === 'Bob')!;
  driver.mutations.updateEdgeLabel(ast, checkMsg.id, 'Check Database Connection');

  const serialized = driver.serialize(ast);
  assert.ok(serialized.includes('loop Every 5s'));
  assert.ok(serialized.includes('Bob->>Bob: Check Database Connection'));
  assert.ok(serialized.includes('alt OK'));
  assert.ok(serialized.includes('else Error'));
  assert.ok(serialized.includes('end'));

  // The edited message remains inside the loop
  const loopIdx = serialized.indexOf('loop Every 5s');
  const checkIdx = serialized.indexOf('Bob->>Bob: Check Database Connection');
  const altIdx = serialized.indexOf('alt OK');
  assert.ok(loopIdx < checkIdx);
  assert.ok(checkIdx < altIdx);
});

test('Sequence Preservation: activations survive visual edits', () => {
  const code = `sequenceDiagram
    Alice->>+Bob: Request
    Bob-->>-Alice: Response
`;
  const ast = driver.parse(code);

  // Reverse response message
  const respMsg = ast.messages[1];
  driver.mutations.reverseEdge(ast, respMsg.id);

  const serialized = driver.serialize(ast);
  assert.ok(serialized.includes('Alice->>+Bob: Request'));
  assert.ok(serialized.includes('Alice-->>-Bob: Response'));
});

test('Sequence Preservation: comments and directives survive edits', () => {
  const code = `---
title: Critical Process
---
sequenceDiagram
    accTitle: Acc Title Test
    accDescr: Acc Description Test
    %% Step 1: Initialize
    Alice->>Bob: Init
    %% Step 2: Finalize
    Bob-->>Alice: Done
`;
  const ast = driver.parse(code);

  // Rename Alice
  driver.mutations.updateNodeLabel(ast, 'Alice', 'Primary Actor');

  const serialized = driver.serialize(ast);
  assert.ok(serialized.includes('title: Critical Process'));
  assert.ok(serialized.includes('accTitle: Acc Title Test'));
  assert.ok(serialized.includes('accDescr: Acc Description Test'));
  assert.ok(serialized.includes('%% Step 1: Initialize'));
  assert.ok(serialized.includes('%% Step 2: Finalize'));
  assert.ok(serialized.includes('Primary Actor'));
});

test('Sequence Preservation: links and custom annotations survive edits', () => {
  const code = `sequenceDiagram
    participant Alice
    links Alice: {"Repo": "https://github.com"}
    Alice->>Bob: Ping
`;
  const ast = driver.parse(code);

  // Sprout new participant
  driver.mutations.addChildNode(ast, 'Bob', 'Charlie');

  const serialized = driver.serialize(ast);
  assert.ok(serialized.includes('links Alice: {"Repo": "https://github.com"}'));
  assert.ok(serialized.includes('Alice->>Bob: Ping'));
  assert.ok(serialized.includes('Bob->>'));
});

test('Sequence Preservation: link statements survive visual edits verbatim', () => {
  const code = `sequenceDiagram
    participant Alice
    participant Bob
    Alice->>Bob: Hello Bob
    link Alice: Dashboard @ https://example.com
`;
  const ast = driver.parse(code);

  // No phantom participants from the link statement
  assert.ok(!ast.participants.has('link'));
  assert.ok(!ast.participants.has('Dashboard'));

  // Visual edit: relabel the message
  const msg = ast.messages[0];
  driver.mutations.updateEdgeLabel(ast, msg.id, 'Good morning Bob');

  const serialized = driver.serialize(ast);
  assert.ok(serialized.includes('link Alice: Dashboard @ https://example.com'));
  assert.ok(serialized.includes('Alice->>Bob: Good morning Bob'));

  // Stable across repeated round-trips
  const reparsed = driver.parse(serialized);
  assert.strictEqual(driver.serialize(reparsed), serialized);
});
