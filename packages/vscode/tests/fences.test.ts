import test from 'node:test';
import assert from 'node:assert/strict';
import {
  findMermaidFences,
  findNearestFence,
  formatFenceTitle,
  getEncodedQuery,
  parseEditFenceUri,
  resolveTargetFence,
} from '../src/fences';

test('Fences: enumerates multiple closed blocks with code', () => {
  const text = [
    '# Notes',
    '',
    '```mermaid',
    'flowchart LR',
    '    A --> B',
    '```',
    '',
    'Some prose.',
    '',
    '```mermaid',
    'sequenceDiagram',
    '    A->>B: hi',
    '```',
    '',
  ].join('\n');
  const fences = findMermaidFences(text);
  assert.strictEqual(fences.length, 2);
  assert.deepStrictEqual(
    { start: fences[0].startLine, end: fences[0].endLine },
    { start: 2, end: 5 }
  );
  assert.ok(fences[0].code.includes('flowchart LR'));
  assert.deepStrictEqual(
    { start: fences[1].startLine, end: fences[1].endLine },
    { start: 9, end: 12 }
  );
  assert.ok(fences[1].code.includes('sequenceDiagram'));
});

test('Fences: ignores non-mermaid fences and inline backticks', () => {
  const text = [
    '```ts',
    'const x = 1;',
    '```',
    '',
    'Use `code` inline, not a fence.',
    '',
    '```mermaid',
    'flowchart LR',
    '    A --> B',
    '```',
  ].join('\n');
  const fences = findMermaidFences(text);
  assert.strictEqual(fences.length, 1);
  assert.strictEqual(fences[0].startLine, 6);
});

test('Fences: unclosed block still offers a lens to the end of doc', () => {
  const text = ['# T', '', '```mermaid', 'flowchart LR', '    A --> B'].join('\n');
  const fences = findMermaidFences(text);
  assert.strictEqual(fences.length, 1);
  assert.strictEqual(fences[0].startLine, 2);
  assert.strictEqual(fences[0].endLine, 4);
  assert.ok(fences[0].code.includes('flowchart LR'));
});

test('Fences: empty document and fence-free document yield nothing', () => {
  assert.deepStrictEqual(findMermaidFences(''), []);
  assert.deepStrictEqual(findMermaidFences('# Just prose\n\nNo fences.\n'), []);
});

test('Fences: findNearestFence locates containing fence or closest neighbor', () => {
  const fences = [
    { startLine: 5, endLine: 10, code: 'flowchart LR' },
    { startLine: 20, endLine: 25, code: 'sequenceDiagram' },
  ];

  // Inside first fence
  assert.strictEqual(findNearestFence(fences, 7)?.startLine, 5);
  // Inside second fence
  assert.strictEqual(findNearestFence(fences, 22)?.startLine, 20);
  // Above first fence
  assert.strictEqual(findNearestFence(fences, 1)?.startLine, 5);
  // Below second fence
  assert.strictEqual(findNearestFence(fences, 30)?.startLine, 20);
  // Between fences, closer to first (line 12 vs 10=2 dist, vs 20=8 dist)
  assert.strictEqual(findNearestFence(fences, 12)?.startLine, 5);
  // Between fences, closer to second (line 18 vs 10=8 dist, vs 20=2 dist)
  assert.strictEqual(findNearestFence(fences, 18)?.startLine, 20);
  // Empty fences
  assert.strictEqual(findNearestFence([], 10), undefined);
});

test('Fences: formatFenceTitle provides human-friendly titles with progress indicators', () => {
  const singleFence = [{ startLine: 4, endLine: 8, code: 'flowchart LR' }];
  const multiFences = [
    { startLine: 4, endLine: 8, code: 'flowchart LR' },
    { startLine: 15, endLine: 20, code: 'sequenceDiagram' },
    { startLine: 35, endLine: 40, code: 'classDiagram' },
  ];

  // Single diagram
  assert.strictEqual(
    formatFenceTitle('/path/to/architecture.md', 4, singleFence),
    'Merlay: architecture.md (L5)'
  );

  // Multi diagrams: index indicators
  assert.strictEqual(
    formatFenceTitle('/docs/spec.md', 4, multiFences),
    'Merlay: spec.md [1/3]'
  );
  assert.strictEqual(
    formatFenceTitle('/docs/spec.md', 15, multiFences),
    'Merlay: spec.md [2/3]'
  );
  assert.strictEqual(
    formatFenceTitle('C:\\Users\\Dev\\notes.md', 35, multiFences),
    'Merlay: notes.md [3/3]'
  );
});

test('Fences: parseEditFenceUri parses path and query arguments', () => {
  // Full URI params
  const res1 = parseEditFenceUri(
    '/edit-fence',
    'line=14&index=1&file=file%3A%2F%2F%2Fpath%2Fnote.md'
  );
  assert.deepStrictEqual(res1, {
    targetLine: 14,
    diagramIndex: 1,
    targetFile: 'file:///path/note.md',
  });

  // Short path /edit
  const res2 = parseEditFenceUri('/edit', 'line=5');
  assert.deepStrictEqual(res2, {
    targetLine: 5,
    diagramIndex: undefined,
    targetFile: undefined,
  });

  // Invalid path
  assert.strictEqual(parseEditFenceUri('/other-path', 'line=5'), undefined);

  // Non-numeric line/index
  const res3 = parseEditFenceUri('/edit-fence', 'line=abc&index=xyz&file=note.md');
  assert.deepStrictEqual(res3, {
    targetLine: undefined,
    diagramIndex: undefined,
    targetFile: 'note.md',
  });
});

test('Fences: getEncodedQuery keeps separators inside encoded file paths', () => {
  const uri =
    'vscode://dev-hashemi.merlay/edit-fence?line=3&index=0&file=file%3A%2F%2F%2Ftmp%2Fa%26b.md#frag';
  const parsed = parseEditFenceUri('/edit-fence', getEncodedQuery(uri));
  assert.deepStrictEqual(parsed, {
    targetLine: 3,
    diagramIndex: 0,
    targetFile: 'file:///tmp/a&b.md',
  });

  assert.strictEqual(getEncodedQuery('vscode://dev-hashemi.merlay/edit-fence'), '');
  assert.strictEqual(
    getEncodedQuery('vscode://dev-hashemi.merlay/edit-fence#frag?not-a-query'),
    ''
  );
});

test('Fences: resolveTargetFence resolves by index, line, or fallback', () => {
  const fences = [
    { startLine: 5, endLine: 10, code: 'flowchart LR' },
    { startLine: 20, endLine: 25, code: 'sequenceDiagram' },
    { startLine: 40, endLine: 45, code: 'classDiagram' },
  ];

  // Empty fences
  assert.strictEqual(resolveTargetFence([], 5, 0), undefined);

  // Direct index resolution
  assert.strictEqual(resolveTargetFence(fences, undefined, 1)?.startLine, 20);
  assert.strictEqual(resolveTargetFence(fences, 5, 2)?.startLine, 40);

  // Line resolution when index is undefined or out of range
  assert.strictEqual(resolveTargetFence(fences, 22, undefined)?.startLine, 20);
  assert.strictEqual(resolveTargetFence(fences, 42, 99)?.startLine, 40);

  // Default fallback to first fence when neither matches
  assert.strictEqual(resolveTargetFence(fences, undefined, undefined)?.startLine, 5);
});

