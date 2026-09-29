import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseSequenceNote,
  formatSequenceNote,
  parseStateNoteLine,
  formatStateNote,
  parseClassNoteLine,
  formatClassNote,
  findNotesForTarget,
  updateNoteInRawLines,
  DiagramNoteDetails,
} from '../src/diagrams/common/diagramNotes';

test('diagramNotes: sequence note parse and format', () => {
  const left = parseSequenceNote('Note left of Alice: Wait for ACK');
  assert.deepEqual(left, {
    position: 'left',
    targetId: 'Alice',
    secondTargetId: undefined,
    text: 'Wait for ACK',
  });
  assert.equal(formatSequenceNote(left!), 'Note left of Alice: Wait for ACK');

  const overBoth = parseSequenceNote('Note over Alice, Bob: Shared state sync');
  assert.deepEqual(overBoth, {
    position: 'over',
    targetId: 'Alice',
    secondTargetId: 'Bob',
    text: 'Shared state sync',
  });
  assert.equal(formatSequenceNote(overBoth!), 'Note over Alice,Bob: Shared state sync');

  const overSingle = parseSequenceNote('Note over Alice: Single target note');
  assert.deepEqual(overSingle, {
    position: 'over',
    targetId: 'Alice',
    secondTargetId: undefined,
    text: 'Single target note',
  });
  // Must NOT include an extra "of"
  assert.equal(formatSequenceNote(overSingle!), 'Note over Alice: Single target note');

  const multiline = formatSequenceNote({
    targetId: 'Alice',
    position: 'right',
    text: 'Line 1\nLine 2',
  });
  assert.equal(multiline, 'Note right of Alice: Line 1<br/>Line 2');
});

test('diagramNotes: state note parse and format', () => {
  const single = parseStateNoteLine('note right of Active : User is logged in');
  assert.deepEqual(single, {
    position: 'right',
    targetId: 'Active',
    text: 'User is logged in',
  });
  assert.equal(formatStateNote(single!), 'note right of Active : User is logged in');

  const multi = formatStateNote({
    targetId: 'Processing',
    position: 'left',
    text: 'Timeout: 30s\nRetry limit: 3',
  });
  assert.equal(
    multi,
    'note left of Processing\n    Timeout: 30s\n    Retry limit: 3\nend note'
  );
});

test('diagramNotes: class note parse and format', () => {
  const single = parseClassNoteLine('note for Customer "Represents buyer"');
  assert.deepEqual(single, {
    targetId: 'Customer',
    text: 'Represents buyer',
  });
  assert.equal(formatClassNote(single!), 'note for Customer "Represents buyer"');

  const multi = formatClassNote({
    targetId: 'Order',
    text: 'Invoice is generated\nPayment required',
  });
  assert.equal(
    multi,
    'note for Order\n    Invoice is generated\n    Payment required\nend note'
  );
});

test('diagramNotes: updateNoteInRawLines adds, modifies, and deletes notes', () => {
  // 1. State single-line note addition
  const stateLines: Array<{ type: string; text: string }> = [
    { type: 'raw', text: 'state Active' },
  ];
  updateNoteInRawLines(
    stateLines,
    'Active',
    { text: 'Session active', position: 'right' },
    'state'
  );
  assert.equal(stateLines.length, 2);
  assert.equal(stateLines[1].text, 'note right of Active : Session active');

  // Find note
  const foundState = findNotesForTarget(stateLines, 'Active', 'state');
  assert.equal(foundState.length, 1);
  assert.equal(foundState[0].text, 'Session active');
  assert.equal(foundState[0].position, 'right');

  // Modify note to multi-line
  updateNoteInRawLines(
    stateLines,
    'Active',
    { text: 'Line A\nLine B', position: 'left' },
    'state'
  );
  assert.equal(stateLines.length, 5); // state Active, note left, Line A, Line B, end note
  const foundMulti = findNotesForTarget(stateLines, 'Active', 'state');
  assert.equal(foundMulti.length, 1);
  assert.equal(foundMulti[0].text, 'Line A\nLine B');
  assert.equal(foundMulti[0].position, 'left');

  // Delete note
  updateNoteInRawLines(stateLines, 'Active', null, 'state');
  assert.equal(stateLines.length, 1);
  assert.equal(stateLines[0].text, 'state Active');
  assert.equal(findNotesForTarget(stateLines, 'Active', 'state').length, 0);

  // 2. Class note
  const classLines: Array<{ raw: string; order: number }> = [
    { raw: 'class User', order: 1 },
  ];
  updateNoteInRawLines(
    classLines,
    'User',
    { text: 'Auth account' },
    'class'
  );
  assert.equal(classLines.length, 2);
  assert.equal(classLines[1].raw, 'note for User "Auth account"');

  // Delete class note
  updateNoteInRawLines(classLines, 'User', null, 'class');
  assert.equal(classLines.length, 1);
});
