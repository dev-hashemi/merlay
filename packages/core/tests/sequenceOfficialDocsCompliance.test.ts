import test from 'node:test';
import assert from 'node:assert';
import { detectDiagramType, getDriver } from '../src/diagrams/registry';
import { DiagramDriver } from '../src/diagrams/types';

const sequenceDriver = getDriver('sequenceDiagram')!;

function roundTrip(driver: DiagramDriver, code: string) {
  const ast = driver.parse(code);
  return { ast, code: driver.serialize(ast) };
}

test('Official Docs: Header Detection & Template', () => {
  assert.strictEqual(detectDiagramType('sequenceDiagram\n    Alice->>Bob: Hello'), 'sequenceDiagram');
  assert.strictEqual(detectDiagramType('  sequenceDiagram  \n'), 'sequenceDiagram');
  assert.strictEqual(detectDiagramType('%% comment\nsequenceDiagram\n'), 'sequenceDiagram');
  assert.strictEqual(
    detectDiagramType('---\ntitle: Auth\n---\nsequenceDiagram\n'),
    'sequenceDiagram'
  );
});

test('Official Docs: Basic Sequence Diagram', () => {
  const code = `sequenceDiagram
    Alice->>John: Hello John, how are you?
    John-->>Alice: Great!
    Alice-)John: See you later!
`;
  const { ast, code: serialized } = roundTrip(sequenceDriver, code);
  assert.strictEqual(ast.participants.size, 2);
  assert.strictEqual(ast.messages.length, 3);
  assert.ok(ast.participants.has('Alice'));
  assert.ok(ast.participants.has('John'));
  assert.strictEqual(ast.messages[0].label, 'Hello John, how are you?');
  assert.strictEqual(ast.messages[1].label, 'Great!');
  assert.strictEqual(ast.messages[2].arrow, 'solid_async');
  assert.strictEqual(serialized.trim(), code.trim());
});

test('Official Docs: Explicit Participants and Actors', () => {
  const code = `sequenceDiagram
    actor Alice
    actor Bob
    participant John
    participant George
    Alice->>John: Hello John, how are you?
    John-->>Alice: Great!
    Alice->>Bob: Hello Bob, how are you?
    Bob-->>John: Jolly good!
`;
  const { ast, code: serialized } = roundTrip(sequenceDriver, code);
  assert.strictEqual(ast.participants.size, 4);
  assert.strictEqual(ast.participants.get('Alice')!.kind, 'actor');
  assert.strictEqual(ast.participants.get('Bob')!.kind, 'actor');
  assert.strictEqual(ast.participants.get('John')!.kind, 'participant');
  assert.strictEqual(ast.participants.get('George')!.kind, 'participant');
  assert.strictEqual(ast.messages.length, 4);
  assert.strictEqual(serialized.trim(), code.trim());
});

test('Official Docs: Aliases with "as"', () => {
  const code = `sequenceDiagram
    participant A as Alice
    participant J as John
    A->>J: Hello John, how are you?
    J->>A: Great!
`;
  const { ast, code: serialized } = roundTrip(sequenceDriver, code);
  assert.strictEqual(ast.participants.size, 2);
  assert.strictEqual(ast.participants.get('A')!.label, 'Alice');
  assert.strictEqual(ast.participants.get('J')!.label, 'John');
  assert.strictEqual(serialized.trim(), code.trim());
});

test('Official Docs: Grouping with "box"', () => {
  const code = `sequenceDiagram
    box Purple Alice & Bob
        participant Alice
        actor Bob
    end
    box Gray John & George
        participant John
        participant George
    end
    Alice->>John: Hello John, how are you?
    John-->>Alice: Great!
    Alice->>Bob: Hello Bob, how are you?
    Bob-->>John: Jolly good!
`;
  const { ast, code: serialized } = roundTrip(sequenceDriver, code);
  assert.strictEqual(ast.boxes.size, 2);
  assert.strictEqual(ast.participants.size, 4);
  assert.ok(ast.boxes.get('box_1')!.participantIds.includes('Alice'));
  assert.ok(ast.boxes.get('box_1')!.participantIds.includes('Bob'));
  assert.strictEqual(serialized.trim(), code.trim());
});

test('Official Docs: All Arrow Varieties', () => {
  const code = `sequenceDiagram
    Alice->Bob: Solid line without arrow
    Alice-->Bob: Dotted line without arrow
    Alice->>Bob: Solid line with arrowhead
    Bob-->>Alice: Dotted line with arrowhead
    Alice-xBob: Solid line with cross at end
    Bob--xAlice: Dotted line with cross at end
    Alice-)Bob: Solid line with async arrow
    Bob--)Alice: Dotted line with async arrow
`;
  const { ast, code: serialized } = roundTrip(sequenceDriver, code);
  assert.strictEqual(ast.messages.length, 8);
  assert.strictEqual(ast.messages[0].arrow, 'solid_open');
  assert.strictEqual(ast.messages[1].arrow, 'dotted_open');
  assert.strictEqual(ast.messages[2].arrow, 'solid_arrow');
  assert.strictEqual(ast.messages[3].arrow, 'dotted_arrow');
  assert.strictEqual(ast.messages[4].arrow, 'solid_cross');
  assert.strictEqual(ast.messages[5].arrow, 'dotted_cross');
  assert.strictEqual(ast.messages[6].arrow, 'solid_async');
  assert.strictEqual(ast.messages[7].arrow, 'dotted_async');
  assert.strictEqual(serialized.trim(), code.trim());
});

test('Official Docs: Activations (+ and -)', () => {
  const code = `sequenceDiagram
    Alice->>+John: Hello John, how are you?
    Alice->>+John: John, can you hear me?
    John-->>-Alice: Hi Alice, I can hear you!
    John-->>-Alice: I feel great!
`;
  const { ast, code: serialized } = roundTrip(sequenceDriver, code);
  assert.strictEqual(ast.messages[0].activateTarget, true);
  assert.strictEqual(ast.messages[1].activateTarget, true);
  assert.strictEqual(ast.messages[2].deactivateSender, true);
  assert.strictEqual(ast.messages[3].deactivateSender, true);
  assert.strictEqual(serialized.trim(), code.trim());
});

test('Official Docs: Notes (left of, right of, over)', () => {
  const code = `sequenceDiagram
    participant Alice
    participant Bob
    Note left of Alice: Alice thinks
    Alice->>Bob: Hello Bob
    Note right of Bob: Bob responds
    Bob-->>Alice: Hi Alice
    Note over Alice,Bob: A conversation
`;
  const { ast, code: serialized } = roundTrip(sequenceDriver, code);
  assert.strictEqual(ast.messages.length, 2);
  assert.strictEqual(ast.timeline.length, 5);
  assert.strictEqual(serialized.trim(), code.trim());
});

test('Official Docs: Loops', () => {
  const code = `sequenceDiagram
    Alice->>John: Hello John, how are you?
    loop Every minute
        John-->Alice: Great!
    end
`;
  const { ast, code: serialized } = roundTrip(sequenceDriver, code);
  assert.strictEqual(ast.messages.length, 2);
  assert.strictEqual(serialized.trim(), code.trim());
});

test('Official Docs: Alt / Else Conditionals & Opt', () => {
  const code = `sequenceDiagram
    Alice->>Bob: Hello Bob, how are you?
    alt is sick
        Bob-->>Alice: Not so good :(
    else is well
        Bob->>Alice: Feeling fresh like a daisy
    end
    opt Extra response
        Bob->>Alice: Thanks for asking
    end
`;
  const { ast, code: serialized } = roundTrip(sequenceDriver, code);
  assert.strictEqual(ast.messages.length, 4);
  assert.strictEqual(serialized.trim(), code.trim());
});

test('Official Docs: Parallel Actions (par / and)', () => {
  const code = `sequenceDiagram
    par Alice to Bob
        Alice->>Bob: Hello guys!
    and Alice to John
        Alice->>John: Hello guys!
    end
    Bob-->>Alice: Hi Alice!
    John-->>Alice: Hi Alice!
`;
  const { ast, code: serialized } = roundTrip(sequenceDriver, code);
  assert.strictEqual(ast.messages.length, 4);
  assert.strictEqual(serialized.trim(), code.trim());
});

test('Official Docs: Critical and Break Blocks', () => {
  const code = `sequenceDiagram
    critical Establish a connection to the server
        Consumer-->API: Connect
    option Network timeout
        Consumer-->API: Retry
    end
    break when the connection is lost
        Consumer-->API: Terminate
    end
`;
  const { ast, code: serialized } = roundTrip(sequenceDriver, code);
  assert.strictEqual(ast.messages.length, 3);
  assert.strictEqual(serialized.trim(), code.trim());
});

test('Official Docs: Background Rect', () => {
  const code = `sequenceDiagram
    rect rgb(0, 255, 0)
        Alice->>Bob: Hello
        Bob-->>Alice: World
    end
`;
  const { ast, code: serialized } = roundTrip(sequenceDriver, code);
  assert.strictEqual(ast.messages.length, 2);
  assert.strictEqual(serialized.trim(), code.trim());
});

test('Official Docs: YAML Frontmatter and Autonumber', () => {
  const code = `---
title: Authentication Sequence
---
sequenceDiagram
    autonumber
    Alice->>Bob: Request
    Bob-->>Alice: Response
`;
  const { ast, code: serialized } = roundTrip(sequenceDriver, code);
  assert.ok(ast.frontmatter);
  assert.ok(ast.frontmatter.includes('Authentication Sequence'));
  assert.strictEqual(ast.autonumber, true);
  assert.strictEqual(serialized.trim(), code.trim());
});

test('Official Docs: Accessibility Directives', () => {
  const code = `sequenceDiagram
    accTitle: User Login Sequence
    accDescr: Demonstrates user logging in
    Alice->>Bob: Login
    Bob-->>Alice: OK
`;
  const { ast, code: serialized } = roundTrip(sequenceDriver, code);
  assert.strictEqual(ast.directives.length, 2);
  assert.strictEqual(serialized.trim(), code.trim());
});

test('Official Docs: Multi-line accDescr block', () => {
  const code = `sequenceDiagram
    accTitle: Title
    accDescr {
        First line
        Second line
    }
    Alice->>Bob: Login
`;
  const { ast, code: serialized } = roundTrip(sequenceDriver, code);
  assert.strictEqual(ast.directives.length, 2);
  assert.strictEqual(serialized.trim(), code.trim());
});

test('Official Docs: Comments survive round-trip', () => {
  const code = `sequenceDiagram
    %% Header comment
    Alice->>Bob: Hello
    %% Trailing note
    Bob-->>Alice: Hi
`;
  const { ast, code: serialized } = roundTrip(sequenceDriver, code);
  assert.strictEqual(ast.messages.length, 2);
  assert.strictEqual(serialized.trim(), code.trim());
});
