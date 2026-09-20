import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const read = (rel: string): string => readFileSync(join(ROOT, rel), 'utf8');

test('Touch layout: entry button visible without hover on touch', () => {
  const css = read('src/styles.css');
  assert.ok(
    /@media\s*\(pointer:\s*coarse\)[\s\S]*?\.merlay-edit-btn\.merlay-edit-btn[\s\S]*?opacity:\s*1/.test(
      css
    ),
    'Visual-Mode button must not depend on :hover on touch'
  );
});

test('Touch layout: narrow phones scroll one toolbar row and sheet the drawer', () => {
  const css = read('src/styles.css');
  assert.ok(css.includes('@media (max-width: 640px)'), 'needs a narrow-phone breakpoint');
  // A wrapping 2-3 row stack eats ~30% of a phone screen; a single
  // scrollable row keeps every control reachable in one thumb swipe.
  assert.ok(
    /\.mermaid-top-bar-left[\s\S]*?overflow-x:\s*auto/.test(css),
    'top bar must scroll instead of stacking rows'
  );
  assert.ok(
    css.includes('.mermaid-side-code-drawer') && css.includes('width: 100%'),
    'syntax drawer must become full-width on phones'
  );
  assert.ok(css.includes('font-size: 16px'), 'inputs must avoid Android zoom-on-focus');
  assert.ok(
    css.includes('safe-area-inset'),
    'chrome must respect phone notches and gesture bars'
  );
});

test('Touch layout: HUDs and popovers fit narrow screens instead of clipping', () => {
  const css = read('src/styles.css');
  assert.ok(
    /\.mermaid-action-hud[\s\S]*?max-width:\s*calc\(100vw - 16px\)/.test(css),
    'node HUD must cap width and scroll instead of clipping off-screen'
  );
  assert.ok(
    /\.mermaid-shape-popover[\s\S]*?grid-template-columns:\s*1fr/.test(css),
    'shape picker must collapse to one scrollable column on phones'
  );
  assert.ok(
    css.includes('max-width: calc(100vw - 24px)'),
    'popovers must not overflow a 360px viewport'
  );
});

test('Touch layout: no stacked floaters on a tap-selected node', () => {
  // The single-node HUD already sits on the selection — the connect pill
  // would pile a second floater on the same finger target.
  const pill = read('src/canvas/components/ConnectionHintPill.tsx');
  assert.ok(pill.includes('pointer: coarse'), 'pill must detect touch devices');
  assert.ok(
    pill.includes('!hoveredNodeId && selectedNodeId'),
    'pill must yield to the HUD on its selection fallback path'
  );
});

test('Touch layout: desktop mode switcher stays off phones', () => {
  // Empty-canvas drag already pans in select mode on touch, so Select/Hand
  // earns no top-bar space on phones.
  const topBar = read('src/canvas/components/CanvasTopBar.tsx');
  assert.ok(topBar.includes('pointer: coarse'), 'top bar must detect touch devices');
  assert.ok(
    topBar.includes('!isCoarsePointer'),
    'mode switcher must render on desktop only'
  );
});

test('Touch layout: sequence hints use touch wording on coarse pointers', () => {
  const view = read('src/canvas/NativeMermaidView.tsx');
  const seqDriver = read('src/diagrams/sequence/sequenceDriver.ts');
  assert.ok(view.includes('isCoarsePointer'), 'view must detect coarse pointers');
  assert.ok(
    view.includes('driver.canvasHint.touch'),
    'view must render touch hint when pointer is coarse'
  );
  assert.ok(
    seqDriver.includes('Double-tap to rename'),
    'touch hint copy must describe double-tap rename'
  );
});
