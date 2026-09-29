import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getDiagramTitle,
  setDiagramTitle,
} from '../src/diagrams/common/diagramTitle';

test('diagramTitle: getDiagramTitle extracts title from YAML frontmatter', () => {
  const fm1 = 'title: My Architecture Diagram';
  assert.equal(getDiagramTitle(fm1), 'My Architecture Diagram');

  const fm2 = 'title: "Quoted: Title with Special Characters"';
  assert.equal(getDiagramTitle(fm2), 'Quoted: Title with Special Characters');

  const fm3 = "title: 'Single Quoted Title'";
  assert.equal(getDiagramTitle(fm3), 'Single Quoted Title');

  const fmWithConfig = [
    'config:',
    '  theme: dark',
    'title: System Flow',
  ].join('\n');
  assert.equal(getDiagramTitle(fmWithConfig), 'System Flow');
});

test('diagramTitle: getDiagramTitle falls back to in-body raw lines', () => {
  const rawLines1 = [{ text: '%% comment' }, { text: 'title Service Communication' }];
  assert.equal(getDiagramTitle(undefined, rawLines1), 'Service Communication');

  const rawLines2 = [{ raw: 'title: "API Gateway"' }];
  assert.equal(getDiagramTitle(undefined, rawLines2), 'API Gateway');

  // Frontmatter takes precedence over body raw lines
  const fm = 'title: Frontmatter Title';
  const rawLines3 = [{ text: 'title Body Title' }];
  assert.equal(getDiagramTitle(fm, rawLines3), 'Frontmatter Title');
});

test('diagramTitle: setDiagramTitle creates or updates frontmatter', () => {
  // 1. Create title from empty
  const created = setDiagramTitle(undefined, 'User Flow');
  assert.equal(created, 'title: User Flow');

  // 2. Update existing title
  const updated = setDiagramTitle('title: Old Title\nconfig:\n  theme: dark', 'New Title');
  assert.ok(updated?.includes('title: New Title'));
  assert.ok(updated?.includes('theme: dark'));
  assert.ok(!updated?.includes('Old Title'));

  // 3. Quotes special YAML characters properly
  const special = setDiagramTitle(undefined, 'Service: Auth & DB [v2]');
  assert.equal(special, 'title: "Service: Auth & DB [v2]"');

  // 4. Remove title when set to null/empty
  const removed = setDiagramTitle('title: To Delete\nconfig:\n  theme: forest', null);
  assert.equal(removed, 'config:\n  theme: forest');

  // 5. Remove title when it was the only property -> undefined
  const emptyRemoved = setDiagramTitle('title: Solo Title', '');
  assert.equal(emptyRemoved, undefined);
});
