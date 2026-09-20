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
