import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

test('Preview script: embeds Merlay logo icon rather than generic sparkle star', () => {
  const previewSourcePath = join(import.meta.dirname, '..', 'src', 'preview', 'preview.ts');
  const src = readFileSync(previewSourcePath, 'utf8');

  // Verify the preview script defines createLogoIcon with Merlay's signature paths
  assert.ok(src.includes('createLogoIcon'), 'Source should define createLogoIcon');
  assert.ok(!src.includes('createSparkleIcon'), 'Source should no longer contain createSparkleIcon');
  assert.ok(src.includes('0 0 100 100'), 'Logo SVG must use calibrated 100x100 viewBox');
  assert.ok(src.includes('M9717 6473'), 'Logo SVG must include sprout/plus path');
  assert.ok(src.includes('M8003 5999'), 'Logo SVG must include node path');

  // Verify old generic star path is gone
  assert.ok(
    !src.includes('1.912 5.813'),
    'Old 4-point sparkle star path must be removed from preview script'
  );

  // If dist/preview.js has been built, verify it matches
  const distPath = join(import.meta.dirname, '..', 'dist', 'preview.js');
  if (existsSync(distPath)) {
    const dist = readFileSync(distPath, 'utf8');
    assert.ok(dist.includes('0 0 100 100'), 'Dist bundle should contain 100x100 viewBox');
    assert.ok(dist.includes('M9717 6473'), 'Dist bundle should contain logo path');
    assert.ok(!dist.includes('1.912 5.813'), 'Dist bundle should not contain star path');
  }
});
