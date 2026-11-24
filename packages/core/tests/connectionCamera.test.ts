import test from 'node:test';
import assert from 'node:assert/strict';
import { getConnectionPan } from '../src/canvas/hooks/camera/connectionPan';

const viewport = { x: 0, y: 60, width: 800, height: 540 };
const padded = { x: 40, y: 60, width: 720, height: 500 };
const source = { x: 360, y: 180, width: 80, height: 40 };
const target = { x: 520, y: 180, width: 80, height: 40 };
const diagram = { x: 200, y: 100, width: 480, height: 340 };
const defaults = { viewport, padded, wasFullyVisible: true, source, target, diagram };

test('a small relayout preserves the source position', () => {
  assert.deepEqual(getConnectionPan({ ...defaults, oldSourceCenter: { x: 420, y: 190 } }), { x: 20, y: -10 });
});

test('moving the source from the center to the left leaves an already visible diagram in place', () => {
  assert.deepEqual(getConnectionPan({
    ...defaults, source: { ...source, x: 80 }, diagram: { ...diagram, x: 60, width: 680 },
    oldSourceCenter: { x: 400, y: 200 },
  }), { x: 0, y: 0 });
});

test('a previously visible diagram pans only far enough to restore its right margin', () => {
  assert.deepEqual(getConnectionPan({
    ...defaults, diagram: { ...diagram, x: 170, width: 670 },
    oldSourceCenter: { x: 100, y: 200 },
  }), { x: -80, y: 0 });
});

test('a diagram that needs the full viewport can use the side margins', () => {
  assert.deepEqual(getConnectionPan({
    ...defaults, diagram: { ...diagram, x: 60, width: 770 },
    oldSourceCenter: { x: 100, y: 200 },
  }), { x: -30, y: 0 });
});

for (const wasFullyVisible of [true, false]) {
  test(`a large diagram keeps both endpoints visible (previously fully visible: ${wasFullyVisible})`, () => {
    assert.deepEqual(getConnectionPan({
      ...defaults, wasFullyVisible, diagram: { ...diagram, width: 1200 },
      target: { ...target, x: 740 }, oldSourceCenter: { x: 400, y: 200 },
    }), { x: -60, y: 0 });
  });
}

test('a distant drop target takes precedence when the two endpoints cannot fit together', () => {
  assert.deepEqual(getConnectionPan({
    ...defaults, wasFullyVisible: false, target: { ...target, x: 1100 },
    oldSourceCenter: { x: 400, y: 200 },
  }), { x: -420, y: 0 });
});

test('an oversized target is brought into view by its center', () => {
  assert.deepEqual(getConnectionPan({
    ...defaults, wasFullyVisible: false, target: { ...target, x: 600, width: 900 },
    oldSourceCenter: { x: 400, y: 200 },
  }), { x: -290, y: 0 });
});
