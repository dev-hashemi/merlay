import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import mermaid from 'mermaid';
import {
  getDiagramTheme,
  setDiagramTheme,
  MERMAID_THEMES,
} from '../src/diagrams/common';
import { getDriver } from '../src/diagrams/registry';

// Setup jsdom environment for mermaid.parse
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
(global as unknown as { window: unknown }).window = dom.window;
(global as unknown as { document: unknown }).document = dom.window.document;

test('Diagram Theme: getDiagramTheme extracts theme from frontmatter variations', () => {
  // Multiline standard config
  assert.equal(
    getDiagramTheme('config:\n  theme: forest'),
    'forest'
  );

  // Quoted theme
  assert.equal(
    getDiagramTheme("config:\n  theme: 'dark'"),
    'dark'
  );
  assert.equal(
    getDiagramTheme('config:\n  theme: "neutral"'),
    'neutral'
  );

  // Inline object config
  assert.equal(
    getDiagramTheme('config: { theme: base }'),
    'base'
  );

  // Top-level fallback
  assert.equal(
    getDiagramTheme('theme: forest'),
    'forest'
  );

  // Directive fallback
  assert.equal(
    getDiagramTheme(undefined, "%%{init: {'theme': 'dark'}}%%"),
    'dark'
  );

  // No theme present
  assert.equal(
    getDiagramTheme('title: Hello World'),
    undefined
  );
  assert.equal(getDiagramTheme(undefined), undefined);
});

test('Diagram Theme: setDiagramTheme creates, updates, and preserves frontmatter cleanly', () => {
  // 1. Setting theme on empty frontmatter
  assert.equal(
    setDiagramTheme(undefined, 'forest'),
    'config:\n  theme: forest'
  );

  // 2. Updating existing theme
  const updated = setDiagramTheme('config:\n  theme: neutral', 'dark');
  assert.equal(updated, 'config:\n  theme: dark');

  // 3. Preserving other config keys
  const withOtherConfig = setDiagramTheme(
    'title: My Diagram\nconfig:\n  look: handDrawn\n  theme: neutral',
    'forest'
  );
  assert.match(withOtherConfig!, /title: My Diagram/);
  assert.match(withOtherConfig!, /look: handDrawn/);
  assert.match(withOtherConfig!, /theme: forest/);

  // 4. Adding theme to frontmatter that had no config
  const addedConfig = setDiagramTheme('title: Just Title', 'forest');
  assert.match(addedConfig!, /title: Just Title/);
  assert.match(addedConfig!, /config:\n  theme: forest/);

  // 5. Clearing theme: removes theme and empty config block
  const cleared = setDiagramTheme('config:\n  theme: forest', null);
  assert.equal(cleared, undefined);

  // 6. Clearing theme when other keys remain in config
  const clearedKeepsOther = setDiagramTheme(
    'config:\n  theme: forest\n  look: handDrawn',
    null
  );
  assert.equal(clearedKeepsOther, 'config:\n  look: handDrawn');
});

test('Diagram Theme: All 4 drivers support getTheme and setTheme mutations with zero lock-in', () => {
  const driverTypes = ['flowchart', 'mindmap', 'sequenceDiagram', 'stateDiagram'] as const;

  for (const type of driverTypes) {
    const driver = getDriver(type);
    assert.ok(driver, `Driver for ${type} must exist`);

    const code = driver.createDefault();
    const ast = driver.parse(code);

    // Initial theme should be undefined (no frontmatter in createDefault)
    assert.equal(driver.mutations.getTheme?.(ast), undefined);

    // Set theme to forest
    driver.mutations.setTheme?.(ast, 'forest');
    assert.equal(driver.mutations.getTheme?.(ast), 'forest');

    // Serialize and verify standard frontmatter
    const serialized = driver.serialize(ast);
    assert.match(serialized, /^---\n[\s\S]*theme: forest[\s\S]*\n---/);

    // Reparse from serialized string and verify theme survives
    const reparsed = driver.parse(serialized);
    assert.equal(driver.mutations.getTheme?.(reparsed), 'forest');

    // Update theme to dark
    driver.mutations.setTheme?.(reparsed, 'dark');
    assert.equal(driver.mutations.getTheme?.(reparsed), 'dark');
    const darkSerialized = driver.serialize(reparsed);
    assert.match(darkSerialized, /theme: dark/);

    // Clear theme back to default/system
    driver.mutations.setTheme?.(reparsed, null);
    assert.equal(driver.mutations.getTheme?.(reparsed), undefined);
    const clearedSerialized = driver.serialize(reparsed);
    assert.doesNotMatch(clearedSerialized, /theme:/);
  }
});

test('Diagram Theme: Mermaid native parser validates all 4 diagram types with frontmatter themes', async () => {
  const mindmap = `---
config:
  theme: forest
---
mindmap
  root((Central Topic))
    Branch A
    Branch B
`;

  const flowchart = `---
config:
  theme: dark
---
flowchart TD
    A[Start] --> B[End]
`;

  const sequence = `---
config:
  theme: neutral
---
sequenceDiagram
    Alice->>Bob: Hello
`;

  const state = `---
config:
  theme: base
---
stateDiagram-v2
    [*] --> Idle
    Idle --> [*]
`;

  await mermaid.parse(mindmap);
  await mermaid.parse(flowchart);
  await mermaid.parse(sequence);
  await mermaid.parse(state);
});

test('Mindmap Styling: Mindmap driver declares supportsNodeStyles: false', () => {
  const mindmapDriver = getDriver('mindmap')!;
  assert.equal(mindmapDriver.capabilities.supportsNodeStyles, false);
});
