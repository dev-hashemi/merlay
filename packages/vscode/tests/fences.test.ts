import test from 'node:test';
import assert from 'node:assert/strict';
import { findMermaidFences } from '../src/fences';

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
