import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const read = (rel: string): string => readFileSync(join(ROOT, rel), 'utf8');

test('Touch targets: fingertips get wider hit-areas and taller controls', () => {
  // NOTE: root styles.css is a build copy — the source lives in src/styles.css.
  const css = read('src/styles.css');
  assert.ok(
    /\.mermaid-edge-hit-area[\s\S]*?stroke-width:\s*22px/.test(css),
    'coarse pointers need ~22px edge hit-areas'
  );
  assert.ok(css.includes('min-height: 36px'), 'HUD and top-bar buttons need thumb height');
  assert.ok(css.includes('min-height: 40px'), 'popover rows need thumb height');
  // Desktop precision sizing must stay untouched outside the coarse query.
  const desktopHit = read('src/styles.css').match(
    /#merlay-svg-mount\.mermaid-native-svg-mount path\.mermaid-edge-hit-area,[\s\S]*?stroke-width:\s*14px/
  );
  assert.ok(desktopHit, 'desktop 14px edge hit-areas must be preserved');
});

test('Touch targets: node HUD offers keyboard-free duplicate', () => {
  const hud = read('src/canvas/components/NodeActionHud.tsx');
  assert.ok(hud.includes('onDuplicate'), 'HUD must accept a duplicate action');
  assert.ok(hud.includes('CopyIcon'), 'duplicate affordance reuses the copy icon');
  const overlays = read('src/canvas/components/CanvasOverlays.tsx');
  assert.ok(
    overlays.includes('onDuplicateNode={mutations.handleDuplicateSelected}'),
    'HUD duplicate must reuse the existing AST mutation (no new logic)'
  );
});
