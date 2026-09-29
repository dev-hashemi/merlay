/**
 * Shape-host compatibility probing + picker model regressions:
 * - probeUnsupportedKinds finds what the host renderer cannot draw
 *   (e.g. person/bucket/console/browser need mermaid >=11.17.0).
 * - partitionKindOptions keeps recents inside their groups and hides
 *   unsupported kinds everywhere (picker, recents, search).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { probeUnsupportedKinds } from '../src/diagrams/shapeCompat';
import {
  partitionKindOptions,
  KIND_SEARCH_THRESHOLD,
} from '../src/canvas/components/kindPickerModel';
import { FLOWCHART_SHAPES, versionGatedKinds } from '../src/diagrams/flowchart/shapes';
import { FlowchartDriver } from '../src/diagrams/flowchart/flowchartDriver';

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
(global as any).window = dom.window;
(global as any).document = dom.window.document;
(global as any).SVGElement = dom.window.SVGElement;
(global as any).Element = dom.window.Element;
dom.window.SVGElement.prototype.getBBox = () => ({ x: 0, y: 0, width: 10, height: 10 });
(global as any).CSSStyleSheet = class CSSStyleSheet {
  cssRules = [];
  replaceSync() {}
  insertRule() {}
};

async function npmRender(code: string): Promise<string> {
  const mermaid = (await import('mermaid')).default;
  mermaid.initialize({ startOnLoad: false });
  const { svg } = await mermaid.render(`compat_${Math.random().toString(36).slice(2)}`, code);
  return svg;
}

test('Compat: bundled mermaid renders every gated shape (nothing hidden on npm hosts)', async () => {
  const gated = versionGatedKinds() as string[];
  assert.ok(gated.includes('person'), 'person must be version-gated');
  assert.ok(gated.includes('bucket'), 'bucket must be version-gated');
  assert.ok(gated.includes('console'), 'console must be version-gated');
  assert.ok(gated.includes('browser'), 'browser must be version-gated');
  assert.ok(gated.includes('folder'), 'folder must be version-gated');
  const unsupported = await probeUnsupportedKinds(npmRender, gated);
  assert.deepEqual(unsupported, [], 'bundled mermaid 11.17.2 must render all gated shapes');
});

test('Compat: old-renderer stub isolates exactly the failing kinds', async () => {
  // Simulates Obsidian's older bundled mermaid: person unknown, rest fine.
  const oldRender = async (code: string): Promise<string> => {
    if (code.includes('shape: person')) throw new Error('No such shape: person.');
    return '<svg></svg>';
  };
  const unsupported = await probeUnsupportedKinds(oldRender, [
    'person',
    'bucket',
    'console',
    'browser',
  ]);
  assert.deepEqual(unsupported, ['person']);
});

test('Compat: unrelated render failures fail open (hide nothing)', async () => {
  const flaky = async (_code: string): Promise<string> => {
    throw new Error('Network timeout talking to renderer');
  };
  assert.deepEqual(await probeUnsupportedKinds(flaky, ['person', 'bucket']), []);
  assert.deepEqual(await probeUnsupportedKinds(npmRender, []), []);
});

test('Compat: driver exposes gated kinds for probing', () => {
  assert.deepEqual(
    [...(FlowchartDriver.compatProbeKinds ?? [])].sort(),
    [...versionGatedKinds()].sort()
  );
});

const testOptions = FLOWCHART_SHAPES.map((d) => ({
  kind: d.kind as string,
  label: d.label,
  group: d.category,
  keywords: d.keywords,
}));

test('Picker model: recents stay in their groups (shortcuts on top)', () => {
  assert.ok(
    testOptions.length > KIND_SEARCH_THRESHOLD,
    'test needs a searchable option set'
  );
  const part = partitionKindOptions(testOptions, '', ['docs', 'bolt'], []);
  assert.deepEqual(
    part.recents.map((o) => o.kind),
    ['docs', 'bolt']
  );
  // Items must ALSO remain in their groups.
  const allGrouped = part.groups.flatMap((g) => g.items.map((o) => o.kind));
  assert.ok(allGrouped.includes('docs'), 'docs stays in Data & Documents');
  assert.ok(allGrouped.includes('bolt'), 'bolt stays in Logic & Flow');
  assert.equal(allGrouped.length, testOptions.length, 'grouping must not drop items');
});

test('Picker model: unsupported kinds hidden everywhere', () => {
  const unsupported = ['person', 'bucket', 'console', 'browser', 'folder'];
  const part = partitionKindOptions(testOptions, '', ['person', 'docs'], unsupported);
  assert.deepEqual(
    part.recents.map((o) => o.kind),
    ['docs'],
    'unsupported recents are dropped'
  );
  const visible = new Set(part.filtered.map((o) => o.kind));
  for (const kind of unsupported) {
    assert.ok(!visible.has(kind), `${kind} hidden from picker`);
  }
  // Search cannot resurrect hidden kinds.
  const searched = partitionKindOptions(testOptions, 'person', [], unsupported);
  assert.ok(
    !searched.filtered.some((o) => o.kind === 'person'),
    'search must not show unsupported kinds'
  );
});

test('Picker model: search matches intent keywords, small sets stay flat', () => {
  const found = partitionKindOptions(testOptions, 'keyboard', [], []);
  assert.ok(
    found.filtered.some((o) => o.kind === 'sl-rect'),
    'manual-input found via "keyboard" keyword'
  );
  const small = partitionKindOptions(
    [
      { kind: 'a', label: 'A' },
      { kind: 'b', label: 'B' },
    ],
    '',
    [],
    []
  );
  assert.equal(small.searchable, false);
  assert.equal(small.grouped, false);
  assert.equal(small.recents.length, 0);
});
