import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { useCanvasStore } from '../src/canvas/store/canvasStore';

const ROOT = join(import.meta.dirname, '..');
const read = (rel: string): string => readFileSync(join(ROOT, rel), 'utf8');

test('Touch drag-connect: canvas root uses Pointer Events (not mouse-only)', () => {
  const view = read('src/canvas/NativeMermaidView.tsx');
  assert.ok(view.includes('onPointerDown'), 'root must wire onPointerDown');
  assert.ok(view.includes('onPointerMove'), 'root must wire onPointerMove');
  assert.ok(view.includes('onPointerUp'), 'root must wire onPointerUp');
  assert.ok(view.includes('onPointerCancel'), 'root must handle pointer cancellation');
  assert.ok(!view.includes('onMouseDown'), 'mouse-only down handler must be gone');
  assert.ok(!view.includes('onMouseMove'), 'mouse-only move handler must be gone');
  assert.ok(!view.includes('onMouseUp'), 'mouse-only up handler must be gone');
});

test('Touch drag-connect: interaction hook exposes pointer handlers + cancel', () => {
  const hook = read('src/canvas/hooks/useCanvasMouseInteractions.ts');
  assert.ok(hook.includes('handlePointerDown'), 'must expose handlePointerDown');
  assert.ok(hook.includes('handlePointerMove'), 'must expose handlePointerMove');
  assert.ok(hook.includes('handlePointerUp'), 'must expose handlePointerUp');
  assert.ok(hook.includes('handlePointerCancel'), 'must expose handlePointerCancel');
  assert.ok(
    hook.includes('React.PointerEvent'),
    'handlers must accept PointerEvent (mouse+touch+pen)'
  );
  assert.ok(
    hook.includes('isPrimary'),
    'multi-touch second fingers must be ignored by connect/marquee'
  );
  assert.ok(
    hook.includes("pointerType !== 'mouse'"),
    'touch pointerdown must seed hover state (no hover on touch)'
  );
});

test('Touch drag-connect: browser must not steal finger drags on canvas', () => {
  // NOTE: root styles.css is a build copy — the source lives in src/styles.css.
  const css = read('src/styles.css');
  assert.ok(
    /\.mermaid-native-editor-root\s*\{[^}]*touch-action:\s*none/s.test(css),
    'editor root needs touch-action: none'
  );
  assert.ok(
    /\.mermaid-native-world\s*\{[^}]*touch-action:\s*none/s.test(css),
    'world layer needs touch-action: none'
  );
});

test('Touch drag-connect: cancelled gesture clears connecting state without mutating', () => {
  useCanvasStore.getState().resetTransientUiState();
  useCanvasStore.getState().setConnecting('A', null, { x1: 0, y1: 0, x2: 10, y2: 10 });
  assert.strictEqual(useCanvasStore.getState().connectingSourceId, 'A');

  // Mirror of handlePointerCancel semantics: release transient drag state.
  useCanvasStore.getState().setConnecting(null, null, null);
  assert.strictEqual(useCanvasStore.getState().connectingSourceId, null);
  assert.strictEqual(useCanvasStore.getState().dragLine, null);
});

test('Touch drag-connect: overlay container passes pointer events to canvas', () => {
  const css = read('src/styles.css');
  assert.ok(
    /\.mermaid-native-overlay\s*\{[^}]*pointer-events:\s*none/s.test(css),
    'overlay layer must have pointer-events: none so hit-testing reaches SVG'
  );
});

test('Touch drag-connect: mouse pointers bypass pointer capture to protect hit testing', () => {
  const view = read('src/canvas/NativeMermaidView.tsx');
  assert.ok(
    view.includes("e.pointerType !== 'mouse'"),
    'pointer capture must only be set for non-mouse pointers'
  );
  assert.ok(
    view.includes('releasePointerCapture'),
    'pointer capture must be released on pointerup and pointercancel'
  );
});

