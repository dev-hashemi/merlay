import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SequenceDiagramDriver } from '../src/diagrams/sequence/sequenceDriver';
import { matchSvgEdgeToAst } from '../src/utils/edgeMatching';

test('Sequence Interactivity: Autonumber message matching in edgeMatching', () => {
  const ast = SequenceDiagramDriver.parse(`sequenceDiagram
    autonumber
    Alice->>Bob: Hello Bob!
    Bob-->>Alice: Hi Alice!
`);
  const projected = SequenceDiagramDriver.project(ast);
  const edges = projected.edges;

  assert.strictEqual(edges.length, 2);

  // 1. Text with autonumber prefix matching
  const matched1 = matchSvgEdgeToAst(
    { textContent: '1: Hello Bob!' },
    edges
  );
  assert.ok(matched1);
  assert.strictEqual(matched1?.label, 'Hello Bob!');

  // 2. Exact text matching
  const matched2 = matchSvgEdgeToAst(
    { textContent: 'Hi Alice!' },
    edges
  );
  assert.ok(matched2);
  assert.strictEqual(matched2?.label, 'Hi Alice!');

  // 3. Fallback index matching
  const fallback = matchSvgEdgeToAst(
    { textContent: '' },
    edges,
    1
  );
  assert.ok(fallback);
  assert.strictEqual(fallback?.label, 'Hi Alice!');
});

test('Sequence Interactivity: Sprouting adds message between existing participants', () => {
  const ast = SequenceDiagramDriver.parse(`sequenceDiagram
    participant Alice
    participant Bob
`);
  assert.strictEqual(ast.messages.length, 0);

  // Sprouting with default "Next Message" from Alice sends message to Bob
  const targetId = SequenceDiagramDriver.mutations.addChildNode(ast, 'Alice', 'Next Message');
  assert.strictEqual(targetId, 'Bob');
  assert.strictEqual(ast.messages.length, 1);
  assert.strictEqual(ast.messages[0].from, 'Alice');
  assert.strictEqual(ast.messages[0].to, 'Bob');
  assert.strictEqual(ast.messages[0].label, 'Message');

  // Sprouting from Bob sends message back to Alice
  const targetId2 = SequenceDiagramDriver.mutations.addChildNode(ast, 'Bob', 'Next Message');
  assert.strictEqual(targetId2, 'Alice');
  assert.strictEqual(ast.messages.length, 2);
  assert.strictEqual(ast.messages[1].from, 'Bob');
  assert.strictEqual(ast.messages[1].to, 'Alice');
});

test('Sequence Interactivity: Sprouting from solo participant creates partner', () => {
  const ast = SequenceDiagramDriver.parse(`sequenceDiagram
    participant Alice
`);
  assert.strictEqual(ast.participants.size, 1);

  const childId = SequenceDiagramDriver.mutations.addChildNode(ast, 'Alice', 'Next Message');
  assert.strictEqual(ast.participants.size, 2);
  assert.ok(ast.participants.has(childId));
  assert.strictEqual(ast.messages.length, 1);
  assert.strictEqual(ast.messages[0].from, 'Alice');
  assert.strictEqual(ast.messages[0].to, childId);
});

test('Sequence Interactivity: Programmatic sprouting with explicit label creates named participant', () => {
  const ast = SequenceDiagramDriver.parse(`sequenceDiagram
    participant Alice
    participant Bob
`);
  const p3 = SequenceDiagramDriver.mutations.addChildNode(ast, 'Bob', 'Charlie');
  assert.strictEqual(ast.participants.size, 3);
  assert.strictEqual(ast.participants.get(p3)!.label, 'Charlie');
  assert.strictEqual(ast.messages.length, 1);
  assert.strictEqual(ast.messages[0].from, 'Bob');
  assert.strictEqual(ast.messages[0].to, p3);
});

test('Sequence Interactivity: Connecting participants via drag-connect', () => {
  const ast = SequenceDiagramDriver.parse(`sequenceDiagram
    participant Client
    participant Server
`);
  SequenceDiagramDriver.mutations.connect(ast, 'Client', 'Server');
  assert.strictEqual(ast.messages.length, 1);
  assert.strictEqual(ast.messages[0].from, 'Client');
  assert.strictEqual(ast.messages[0].to, 'Server');

  // Reversing message
  const msgId = ast.messages[0].id;
  SequenceDiagramDriver.mutations.reverseEdge(ast, msgId);
  assert.strictEqual(ast.messages[0].from, 'Server');
  assert.strictEqual(ast.messages[0].to, 'Client');

  // Changing message arrow type
  SequenceDiagramDriver.mutations.updateEdgeType(ast, msgId, 'dotted');
  assert.strictEqual(ast.messages[0].arrow, 'dotted_arrow');
});

test('Sequence Interactivity: Participant names with quotes and special characters round-trip cleanly', () => {
  const original = `sequenceDiagram
    participant A as Alice "The Boss" Smith
    actor B as Bob 'The Builder'
    A->>B: Work hard!
`;
  const ast = SequenceDiagramDriver.parse(original);
  assert.strictEqual(ast.participants.get('A')!.label, 'Alice "The Boss" Smith');
  assert.strictEqual(ast.participants.get('B')!.label, "Bob 'The Builder'");

  // Serializing does not inject unnecessary backslashes or outer quotes
  const serialized = SequenceDiagramDriver.serialize(ast);
  assert.ok(serialized.includes('participant A as Alice "The Boss" Smith'));
  assert.ok(serialized.includes("actor B as Bob 'The Builder'"));
  assert.ok(!serialized.includes('\\"'));

  // Updating label with quotes
  SequenceDiagramDriver.mutations.updateNodeLabel(ast, 'A', 'Alice "Chief Executive" Smith');
  assert.strictEqual(ast.participants.get('A')!.label, 'Alice "Chief Executive" Smith');

  const serialized2 = SequenceDiagramDriver.serialize(ast);
  assert.ok(serialized2.includes('participant A as Alice "Chief Executive" Smith'));
  assert.ok(!serialized2.includes('\\"'));

  // Re-parsing retains the exact label without corruption
  const reparsed = SequenceDiagramDriver.parse(serialized2);
  assert.strictEqual(reparsed.participants.get('A')!.label, 'Alice "Chief Executive" Smith');
});

test('Sequence Interactivity: Box management (rename, dissolve, delete with members)', () => {
  const code = `sequenceDiagram
    box Purple "Frontend Services"
        participant Web as Web App
        participant Mobile as Mobile App
    end
    box Gray "Backend Services"
        participant API as Core API
    end
    Web->>API: Fetch data
`;
  const ast = SequenceDiagramDriver.parse(code);
  const proj = SequenceDiagramDriver.project(ast);

  // Boxes are projected as subgraphs for selection and HUD
  assert.strictEqual(proj.subgraphs.size, 2);
  const box1 = Array.from(proj.subgraphs.values())[0];
  assert.strictEqual(box1.label, 'Frontend Services');
  assert.deepStrictEqual(box1.nodeIds, ['Web', 'Mobile']);

  // Rename box
  SequenceDiagramDriver.mutations.renameGroup(ast, box1.id, 'Client Applications');
  assert.strictEqual(ast.boxes.get(box1.id)!.label, 'Client Applications');

  const serializedRename = SequenceDiagramDriver.serialize(ast);
  assert.ok(serializedRename.includes('box Purple "Client Applications"') || serializedRename.includes('box Purple Client Applications'));

  // Dissolve box (deleteGroup with deleteMembers = false)
  SequenceDiagramDriver.mutations.deleteGroup(ast, box1.id, false);
  assert.ok(!ast.boxes.has(box1.id));
  assert.ok(ast.participants.has('Web'));
  assert.ok(ast.participants.has('Mobile'));
  assert.strictEqual(ast.participants.get('Web')!.boxId, undefined);

  // Delete box with members (deleteGroup with deleteMembers = true)
  const box2Id = Array.from(ast.boxes.keys())[0];
  SequenceDiagramDriver.mutations.deleteGroup(ast, box2Id, true);
  assert.ok(!ast.boxes.has(box2Id));
  assert.ok(!ast.participants.has('API'));
  // Cascaded message involving API is removed
  assert.strictEqual(ast.messages.length, 0);
});

test('Sequence Interactivity: Selection halo extraction for actor-man stick figures vs lifelines', () => {
  // Simulate the selectionHalo extraction logic
  interface MockEl {
    tagName: string;
    classList: string[];
    children: MockEl[];
    closest: (selector: string) => boolean;
  }

  const stickFigure: MockEl = {
    tagName: 'g',
    classList: ['actor-man', 'actor-top'],
    children: [
      { tagName: 'circle', classList: ['actor-man'], children: [], closest: () => false },
      { tagName: 'line', classList: ['actor-man'], children: [], closest: () => false }, // torso
      { tagName: 'line', classList: ['actor-man'], children: [], closest: () => false }, // arms
      { tagName: 'line', classList: ['actor-man'], children: [], closest: () => false }, // leg 1
      { tagName: 'line', classList: ['actor-man'], children: [], closest: () => false }, // leg 2
    ],
    closest: () => false,
  };

  const lifeline: MockEl = {
    tagName: 'line',
    classList: ['actor-line'],
    children: [],
    closest: () => false,
  };

  const bottomBox: MockEl = {
    tagName: 'rect',
    classList: ['actor', 'actor-bottom'],
    children: [],
    closest: () => false,
  };

  // Node skipping test — whole participant (top + lifeline + bottom) highlights together.
  // Only the invisible lifeline hit-area overlay is skipped.
  function shouldSkipNodeEl(nodeEl: MockEl): boolean {
    return nodeEl.classList.includes('mermaid-lifeline-hit-area');
  }

  const hitArea: MockEl = {
    tagName: 'line',
    classList: ['mermaid-lifeline-hit-area'],
    children: [],
    closest: () => false,
  };

  assert.strictEqual(shouldSkipNodeEl(stickFigure), false, 'Stick figure top group should NOT be skipped');
  assert.strictEqual(shouldSkipNodeEl(lifeline), false, 'Lifeline line should NOT be skipped (whole participant highlights)');
  assert.strictEqual(shouldSkipNodeEl(bottomBox), false, 'Bottom actor should NOT be skipped (whole participant highlights)');
  assert.strictEqual(shouldSkipNodeEl(hitArea), true, 'Invisible lifeline hit-area should be skipped');

  // Shape elements extraction test
  function extractShapes(nodeEl: MockEl): MockEl[] {
    let shapes = nodeEl.children.filter((el) => {
      if (el.classList.includes('mermaid-node-selection-halo')) return false;
      if (el.classList.includes('mermaid-drop-target-halo')) return false;
      if (el.classList.includes('mermaid-lifeline-hit-area')) return false;
      return ['rect', 'circle', 'polygon', 'path', 'ellipse', 'line'].includes(el.tagName);
    });

    if (!nodeEl.classList.includes('actor-man')) {
      const primary = shapes.filter(
        (el) =>
          el.classList.includes('actor-top') ||
          el.classList.includes('actor-bottom') ||
          el.classList.includes('actor') ||
          el.classList.includes('basic')
      );
      if (primary.length > 0) shapes = primary;
    }
    return shapes;
  }

  const shapes = extractShapes(stickFigure);
  assert.strictEqual(shapes.length, 5, 'All 5 stick figure parts (head circle + 4 limbs/torso lines) should be extracted for halo');
  assert.strictEqual(shapes[0].tagName, 'circle');
  assert.strictEqual(shapes[1].tagName, 'line');
  assert.strictEqual(shapes[2].tagName, 'line');
  assert.strictEqual(shapes[3].tagName, 'line');
  assert.strictEqual(shapes[4].tagName, 'line');
});

test('Sequence Interactivity: Connect inserts message at drag position rather than always at the end', () => {
  const code = `sequenceDiagram
    participant Alice
    participant Bob
    Alice->>Bob: Message 1
    Bob->>Alice: Message 2
    Alice->>Bob: Message 3
`;
  const ast = SequenceDiagramDriver.parse(code);
  assert.strictEqual(ast.messages.length, 3);
  const msg1Id = ast.messages[0].id;
  const msg2Id = ast.messages[1].id;

  // 1. Insert between Message 1 and Message 2
  SequenceDiagramDriver.mutations.connect(ast, 'Bob', 'Alice', {
    insertAfterEdgeId: msg1Id,
  });

  assert.strictEqual(ast.messages.length, 4);
  assert.strictEqual(ast.timeline.length, 4);
  // Verify order in timeline
  assert.strictEqual((ast.timeline[0] as any).message.label, 'Message 1');
  assert.strictEqual((ast.timeline[1] as any).message.label, 'Message');
  assert.strictEqual((ast.timeline[1] as any).message.from, 'Bob');
  assert.strictEqual((ast.timeline[1] as any).message.to, 'Alice');
  assert.strictEqual((ast.timeline[2] as any).message.label, 'Message 2');
  assert.strictEqual((ast.timeline[3] as any).message.label, 'Message 3');

  // Verify serialized code order
  const serialized1 = SequenceDiagramDriver.serialize(ast);
  const lines1 = serialized1.split('\n').filter((l) => l.includes('->>'));
  assert.strictEqual(lines1[0].trim(), 'Alice->>Bob: Message 1');
  assert.strictEqual(lines1[1].trim(), 'Bob->>Alice: Message');
  assert.strictEqual(lines1[2].trim(), 'Bob->>Alice: Message 2');
  assert.strictEqual(lines1[3].trim(), 'Alice->>Bob: Message 3');

  // 2. Insert at the very top (index 0)
  SequenceDiagramDriver.mutations.connect(ast, 'Alice', 'Bob', {
    insertAtIndex: 0,
  });
  assert.strictEqual(ast.messages.length, 5);
  assert.strictEqual((ast.timeline[0] as any).message.label, 'Message');
  assert.strictEqual((ast.timeline[1] as any).message.label, 'Message 1');

  const serialized2 = SequenceDiagramDriver.serialize(ast);
  const lines2 = serialized2.split('\n').filter((l) => l.includes('->>'));
  assert.strictEqual(lines2[0].trim(), 'Alice->>Bob: Message');
  assert.strictEqual(lines2[1].trim(), 'Alice->>Bob: Message 1');
});

test('Sequence Interactivity: Participant text hover resolves to primary header box (no redundant text handle)', () => {
  // Mock DOM elements matching Mermaid sequence diagram output
  const rectActor = {
    tagName: 'rect',
    classList: ['actor', 'actor-top'],
    attributes: { name: 'Alice', 'data-mermaid-node-id': 'Alice' },
  };
  const textActor = {
    tagName: 'text',
    classList: ['actor', 'actor-top'],
    attributes: { 'data-mermaid-node-id': 'Alice' },
  };

  const mountEl = {
    querySelector: (sel: string) => {
      if (sel.includes('rect.actor-top[name="Alice"]')) return rectActor;
      return null;
    },
  };

  // Algorithm from nodeInteractivity
  function resolveTargetEl(htmlEl: any, targetNodeId: string) {
    let targetEl = htmlEl;
    const isText = htmlEl.tagName.toLowerCase() === 'text';
    const isActor = htmlEl.classList.includes('actor');
    if (isText || isActor) {
      const topHeader = mountEl.querySelector(`rect.actor-top[name="${targetNodeId}"]`);
      if (topHeader) targetEl = topHeader;
    }
    return targetEl;
  }

  // Hovering text resolves to rectActor
  const targetFromText = resolveTargetEl(textActor, 'Alice');
  assert.strictEqual(targetFromText, rectActor, 'Text hover must resolve to primary header rect');

  // Hovering rect also resolves to rectActor
  const targetFromRect = resolveTargetEl(rectActor, 'Alice');
  assert.strictEqual(targetFromRect, rectActor, 'Rect hover must resolve to primary header rect');
});

test('Sequence Interactivity: Lifeline hover handle accurately tracks cursor Y position along the line', () => {
  const lineRect = { x: 100, y: 50, width: 2, height: 400 };
  const getLocalPoint = (clientX: number, clientY: number) => ({ x: clientX, y: clientY });

  function calculateLifelineHandleRect(mouseClientY: number) {
    const pt = getLocalPoint(101, mouseClientY);
    const lineCenterX = lineRect.x + lineRect.width / 2; // 101
    const targetY = pt.y;
    const clampedY = Math.max(
      lineRect.y + 12,
      Math.min(lineRect.y + lineRect.height - 12, targetY)
    );
    return {
      x: lineCenterX - 10,
      y: clampedY - 10,
      width: 20,
      height: 10,
      clampedY,
    };
  }

  // Hover near middle (Y = 220)
  const h1 = calculateLifelineHandleRect(220);
  assert.strictEqual(h1.clampedY, 220);
  assert.strictEqual(h1.x + h1.width / 2, 101, 'Handle center X should match lifeline X');
  assert.strictEqual(h1.y + h1.height, 220, 'Handle Y should match cursor Y');

  // Hover near top boundary (Y = 55) -> clamped to 62
  const h2 = calculateLifelineHandleRect(55);
  assert.strictEqual(h2.clampedY, 62, 'Handle Y should clamp near top margin');

  // Hover near bottom boundary (Y = 460) -> clamped to 438
  const h3 = calculateLifelineHandleRect(460);
  assert.strictEqual(h3.clampedY, 438, 'Handle Y should clamp near bottom margin');
});


