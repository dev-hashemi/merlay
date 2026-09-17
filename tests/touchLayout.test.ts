import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const read = (rel: string): string => readFileSync(join(ROOT, rel), 'utf8');

test('Touch layout: diagram modal starts fullscreen on phones', () => {
  const modal = read('src/views/MermaidBlockModal.tsx');
  assert.ok(modal.includes('pointer: coarse'), 'modal must detect touch devices');
  assert.ok(modal.includes('innerWidth < 700'), 'modal must detect narrow viewports');
  assert.ok(
    modal.includes('this.toggleFullscreen()'),
    'modal must reuse the existing fullscreen toggle'
  );
});

test('Touch layout: entry button visible without hover on touch', () => {
  // NOTE: root styles.css is a build copy — the source lives in src/styles.css.
  const css = read('src/styles.css');
  assert.ok(
    /@media\s*\(pointer:\s*coarse\)[\s\S]*?\.merlay-edit-btn\.merlay-edit-btn[\s\S]*?opacity:\s*1/.test(
      css
    ),
    'Visual-Mode button must not depend on :hover on touch'
  );
});

test('Touch layout: narrow phones wrap controls and sheet the drawer', () => {
  const css = read('src/styles.css');
  assert.ok(css.includes('@media (max-width: 640px)'), 'needs a narrow-phone breakpoint');
  assert.ok(css.includes('flex-wrap: wrap'), 'top bar must wrap instead of clipping');
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

test('Touch layout: sequence hints use touch wording on coarse pointers', () => {
  const view = read('src/canvas/NativeMermaidView.tsx');
  assert.ok(view.includes('isCoarsePointer'), 'view must detect coarse pointers');
  assert.ok(
    view.includes('Double-tap to rename'),
    'touch hint copy must describe double-tap rename'
  );
});
