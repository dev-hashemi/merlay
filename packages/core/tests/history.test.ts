import test from 'node:test';
import assert from 'node:assert/strict';
import { HistoryManager } from '../src/canvas/historyManager';

test('HistoryManager: pushes states and performs undo / redo cleanly', () => {
  const history = new HistoryManager<string>('state-0', 5);
  assert.equal(history.canUndo, false);
  assert.equal(history.canRedo, false);
  assert.equal(history.state, 'state-0');

  // Push state-1
  history.push('state-1');
  assert.equal(history.canUndo, true);
  assert.equal(history.canRedo, false);
  assert.equal(history.state, 'state-1');

  // Push state-2
  history.push('state-2');
  assert.equal(history.canUndo, true);
  assert.equal(history.state, 'state-2');

  // Undo to state-1
  const prev1 = history.undo();
  assert.equal(prev1, 'state-1');
  assert.equal(history.state, 'state-1');
  assert.equal(history.canUndo, true);
  assert.equal(history.canRedo, true);

  // Undo to state-0
  const prev0 = history.undo();
  assert.equal(prev0, 'state-0');
  assert.equal(history.state, 'state-0');
  assert.equal(history.canUndo, false);
  assert.equal(history.canRedo, true);

  // Undo when empty returns null
  assert.equal(history.undo(), null);

  // Redo to state-1
  const next1 = history.redo();
  assert.equal(next1, 'state-1');
  assert.equal(history.state, 'state-1');

  // Redo to state-2
  const next2 = history.redo();
  assert.equal(next2, 'state-2');
  assert.equal(history.state, 'state-2');
  assert.equal(history.canRedo, false);

  // Redo when at top returns null
  assert.equal(history.redo(), null);
});

test('HistoryManager: pushing a new state discards redo history', () => {
  const history = new HistoryManager<string>('state-0');
  history.push('state-1');
  history.push('state-2');

  history.undo(); // back to state-1
  assert.equal(history.canRedo, true);

  // Branch off: push state-3
  history.push('state-3');
  assert.equal(history.state, 'state-3');
  assert.equal(history.canRedo, false); // Redo cleared!
});

test('HistoryManager: honors maxDepth and drops oldest entries', () => {
  const history = new HistoryManager<string>('s0', 3);
  history.push('s1');
  history.push('s2');
  history.push('s3');
  history.push('s4'); // past has [s1, s2, s3], s0 was dropped

  history.undo(); // s3
  history.undo(); // s2
  history.undo(); // s1
  assert.equal(history.canUndo, false); // s0 is gone, can't undo further
  assert.equal(history.state, 's1');
});

test('HistoryManager: ignores duplicate pushes of identical state', () => {
  const history = new HistoryManager<string>('s0');
  history.push('s0');
  assert.equal(history.canUndo, false);
  history.push('s1');
  history.push('s1');
  history.undo();
  assert.equal(history.state, 's0');
  assert.equal(history.canUndo, false);
});
