import test from 'node:test';
import assert from 'node:assert/strict';
import { findMermaidBlockBounds, replaceMermaidBlock } from '../src/utils/markdownBlock';
import { FlowchartDriver } from '../src/diagrams/flowchart/flowchartDriver';

const original = 'flowchart LR\nA-->B';
const block = `\`\`\`mermaid\n${original}\n\`\`\``;

function rename(): string {
  const ast = FlowchartDriver.parse(original);
  FlowchartDriver.mutations.updateNodeLabel(ast, 'B', 'Renamed');
  return FlowchartDriver.serialize(ast).trim();
}

test('Saving the second identical diagram leaves the first unchanged', () => {
  const document = `${block}\n\n${block}\nFooter`;
  const changed = rename();
  const result = replaceMermaidBlock(document, changed, 5, original);
  assert.equal(result.updatedText, `${block}\n\n\`\`\`mermaid\n${changed}\n\`\`\`\nFooter`);
  assert.equal(result.newStartLine, 5);
  assert.equal(FlowchartDriver.parse(changed).nodes.get('B')?.label, 'Renamed');
});

test('Saving refuses a target whose source changed externally', () => {
  const document = '```mermaid\nflowchart LR\nA-->External\n```';
  assert.throws(() => replaceMermaidBlock(document, rename(), 0, original));
});

test('Saving refuses to replace another diagram after the target is deleted', () => {
  const document = '# Remaining\n```mermaid\nflowchart LR\nX-->Y\n```';
  assert.throws(() => replaceMermaidBlock(document, rename(), 5, original));
});

test('Saving refuses ambiguous identical diagrams with a stale location', () => {
  assert.throws(() => replaceMermaidBlock(`${block}\n\n${block}`, rename(), 100, original));
});

test('Saving a removed last diagram does not append or heal another block', () => {
  assert.throws(() => replaceMermaidBlock('# Note\nKeep this text.', rename(), 0, original));
});

test('Saving an externally changed empty diagram does not overwrite its new contents', () => {
  assert.throws(() => replaceMermaidBlock(block, rename(), 0, ''));
});

test('Saving follows the second identical diagram when text inserted above moves it', () => {
  const before = `${block}\n\n${block}`;
  const prefix = 'One\nTwo\nThree\nFour\nFive\n';
  const changed = rename();
  const result = replaceMermaidBlock(prefix + before, changed, 5, original, undefined, before);
  assert.equal(result.newStartLine, 10);
  assert.equal(result.updatedText, `${prefix}${block}\n\n\`\`\`mermaid\n${changed}\n\`\`\``);
});

test('Saving refuses a deleted target even when an identical diagram remains', () => {
  const before = `${block}\n\n${block}`;
  assert.throws(() => replaceMermaidBlock(block, rename(), 5, original, undefined, before));
});

test('Saving keeps the target when text below changes', () => {
  const before = `${block}\nFooter`;
  const result = replaceMermaidBlock(`${block}\nNew footer`, rename(), 0, original, undefined, before);
  assert.equal(result.updatedText, `\`\`\`mermaid\n${rename()}\n\`\`\`\nNew footer`);
});

test('Source sync follows edits inside the selected block without jumping to its identical neighbor', () => {
  const before = `${block}\n\n${block}`;
  const current = `${block}\n\n\`\`\`mermaid\nflowchart LR\nA-->C\nC-->D\n\`\`\``;
  assert.deepEqual(findMermaidBlockBounds(current.split('\n'), 5, undefined, undefined, before), {
    start: 5, end: 9,
  });
});

test('Source sync refuses a removed opening or closing fence', () => {
  assert.equal(findMermaidBlockBounds(['flowchart LR', 'A-->B', '```'], 0, undefined, undefined, block), null);
  assert.equal(findMermaidBlockBounds(['```mermaid', 'flowchart LR', 'A-->B'], 0, undefined, undefined, block), null);
});
