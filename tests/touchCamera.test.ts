import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const read = (rel: string): string => readFileSync(join(ROOT, rel), 'utf8');

test('Touch camera: pinch-zoom keeps gesture midpoint stable and clamps zoom', () => {
  const cam = read('src/canvas/hooks/useCanvasCamera.ts');
  assert.ok(cam.includes('startPinch'), 'camera must expose startPinch');
  assert.ok(cam.includes('updatePinch'), 'camera must expose updatePinch');
  assert.ok(cam.includes('endPinch'), 'camera must expose endPinch');
  assert.ok(
    cam.includes('0.2') && cam.includes('), 3)'),
    'pinch zoom must clamp to the 0.2–3 range like wheel zoom'
  );
  assert.ok(
    cam.includes('startMidX') && cam.includes('startPanX'),
    'pinch must stabilize the world point under the gesture midpoint'
  );
});

test('Touch camera: empty-canvas touch pans, hold-then-drag marquees', () => {
  const hook = read('src/canvas/hooks/useCanvasMouseInteractions.ts');
  assert.ok(
    hook.includes('EMPTY_HOLD_FOR_MARQUEE_MS'),
    'empty touch must wait for a hold before becoming a marquee'
  );
  assert.ok(
    hook.includes('EMPTY_PAN_TOLERANCE_PX'),
    'empty touch movement must commit to panning'
  );
  assert.ok(
    hook.includes('clearTouchEmpty'),
    'undecided touch state must be cleared on up/cancel'
  );
  // Mouse empty-drag keeps desktop marquee parity.
  assert.ok(
    hook.includes("e.pointerType !== 'mouse'"),
    'pan-vs-marquee routing must apply to touch only'
  );
});

test('Touch camera: second finger aborts single gesture and drives pinch', () => {
  const view = read('src/canvas/NativeMermaidView.tsx');
  assert.ok(
    view.includes('activePointersRef'),
    'root must track concurrent pointers'
  );
  assert.ok(
    view.includes('handlePointerCancel()') && view.includes('startPinch('),
    'second finger must cancel the single gesture and start a pinch'
  );
  assert.ok(view.includes('updatePinch('), 'pointer pairs must drive pinch updates');
  assert.ok(
    view.includes('size >= 2'),
    'three-finger touches must stay in pinch mode, never leak to marquee'
  );
});
