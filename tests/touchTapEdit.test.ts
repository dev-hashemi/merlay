import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { JSDOM } from 'jsdom';
import {
  attachTapGestures,
  guardClickAfterLongPress,
} from '../src/canvas/interaction/touchGestures';

const ROOT = join(import.meta.dirname, '..');
const read = (rel: string): string => readFileSync(join(ROOT, rel), 'utf8');

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
(global as unknown as { window: unknown }).window = dom.window;
(global as unknown as { document: unknown }).document = dom.window.document;

function pointerEvent(
  type: string,
  opts: { pointerType?: string; pointerId?: number; clientX?: number; clientY?: number }
): Event {
  return Object.assign(new dom.window.Event(type, { bubbles: true }), {
    pointerType: opts.pointerType ?? 'touch',
    pointerId: opts.pointerId ?? 1,
    clientX: opts.clientX ?? 50,
    clientY: opts.clientY ?? 60,
    isPrimary: true,
  });
}

const tick = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

test('Touch gestures: double-tap fires onDoubleTap, single tap does not', () => {
  const el = document.createElement('div');
  let doubles = 0;
  attachTapGestures(el, { onDoubleTap: () => doubles++ });

  el.dispatchEvent(pointerEvent('pointerdown', {}));
  el.dispatchEvent(pointerEvent('pointerup', {}));
  assert.strictEqual(doubles, 0, 'single tap must not edit');

  el.dispatchEvent(pointerEvent('pointerdown', {}));
  el.dispatchEvent(pointerEvent('pointerup', {}));
  assert.strictEqual(doubles, 1, 'second tap within window must edit');
});

test('Touch gestures: mouse pointers never trigger touch gestures', async () => {
  const el = document.createElement('div');
  let doubles = 0;
  let presses = 0;
  attachTapGestures(el, {
    onDoubleTap: () => doubles++,
    onLongPress: () => presses++,
    longPressDelay: 10,
  });

  el.dispatchEvent(pointerEvent('pointerdown', { pointerType: 'mouse' }));
  el.dispatchEvent(pointerEvent('pointerup', { pointerType: 'mouse' }));
  el.dispatchEvent(pointerEvent('pointerdown', { pointerType: 'mouse' }));
  el.dispatchEvent(pointerEvent('pointerup', { pointerType: 'mouse' }));
  await tick(30);
  assert.strictEqual(doubles, 0, 'mouse double-click stays on dblclick path');
  assert.strictEqual(presses, 0, 'mouse must not long-press');
});

test('Touch gestures: stationary hold fires onLongPress and suppresses release click', async () => {
  const el = document.createElement('div');
  let presses = 0;
  const handle = attachTapGestures(el, {
    onLongPress: () => presses++,
    longPressDelay: 10,
  });

  el.dispatchEvent(pointerEvent('pointerdown', {}));
  await tick(30);
  assert.strictEqual(presses, 1, 'hold must fire long-press');
  assert.ok(handle.shouldSuppressClick(), 'release click must be suppressed');
  el.dispatchEvent(pointerEvent('pointerup', {}));
  handle.detach();
});

test('Touch gestures: drag movement cancels long-press', async () => {
  const el = document.createElement('div');
  let presses = 0;
  attachTapGestures(el, {
    onLongPress: () => presses++,
    longPressDelay: 15,
  });

  el.dispatchEvent(pointerEvent('pointerdown', {}));
  el.dispatchEvent(pointerEvent('pointerup', {}));
  el.dispatchEvent(pointerEvent('pointerdown', { clientX: 0, clientY: 0 }));
  el.dispatchEvent(
    pointerEvent('pointermove', { clientX: 100, clientY: 100 })
  );
  await tick(40);
  assert.strictEqual(presses, 0, 'drag must cancel long-press (it connects/pans)');
});

test('Touch gestures: guard swallows post-long-press click, passes normal clicks', async () => {
  const el = document.createElement('div');
  let clicks = 0;
  (el as unknown as { onclick: ((ev: Event) => void) | null }).onclick = () => {
    clicks++;
  };
  const handle = attachTapGestures(el, {
    onLongPress: () => undefined,
    longPressDelay: 10,
  });
  guardClickAfterLongPress(el, handle);

  const click = new dom.window.Event('click', { bubbles: true });
  (el as unknown as { onclick: ((ev: Event) => void) | null }).onclick?.(click);
  assert.strictEqual(clicks, 1, 'normal clicks pass through');

  el.dispatchEvent(pointerEvent('pointerdown', {}));
  await tick(30);
  (el as unknown as { onclick: ((ev: Event) => void) | null }).onclick?.(click);
  assert.strictEqual(clicks, 1, 'release click after long-press is swallowed');
  handle.detach();
});

test('Touch gestures: all SVG interactivity layers wire tap gestures', () => {
  for (const rel of [
    'src/canvas/interaction/nodeInteractivity.ts',
    'src/canvas/interaction/edgeInteractivity.ts',
    'src/canvas/interaction/clusterInteractivity.ts',
  ]) {
    const code = read(rel);
    assert.ok(
      code.includes('attachTapGestures'),
      `${rel} must attach touch tap gestures`
    );
    assert.ok(
      code.includes('onDoubleTap'),
      `${rel} must support double-tap edit`
    );
  }
  const node = read('src/canvas/interaction/nodeInteractivity.ts');
  assert.ok(node.includes('guardClickAfterLongPress'), 'node clicks need long-press guard');
  const edge = read('src/canvas/interaction/edgeInteractivity.ts');
  assert.ok(edge.includes('guardClickAfterLongPress'), 'edge clicks need long-press guard');
});

test('Touch gestures: hint pill falls back to tap selection (no hover on touch)', () => {
  const pill = read('src/canvas/components/ConnectionHintPill.tsx');
  assert.ok(pill.includes('selectedNodeId'), 'pill must accept tap-selected node');
  assert.ok(pill.includes('selectedNodeRect'), 'pill must accept tap-selected rect');
  const overlays = read('src/canvas/components/CanvasOverlays.tsx');
  assert.ok(
    overlays.includes('selectedNodeId={selectedNodeId}'),
    'overlays must feed selection into the pill'
  );
});
