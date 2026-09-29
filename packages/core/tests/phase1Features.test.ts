import test from 'node:test';
import assert from 'node:assert/strict';
import { FlowchartDriver } from '../src/diagrams/flowchart/flowchartDriver';
import { SequenceDiagramDriver } from '../src/diagrams/sequence/sequenceDriver';
import { StateDiagramDriver } from '../src/diagrams/state/stateDriver';
import { ClassDiagramDriver } from '../src/diagrams/class/classDriver';
import { MindmapDriver } from '../src/diagrams/mindmap/mindmapDriver';

test('Phase 1: Flowchart node links mutation (add, edit, delete)', () => {
  const driver = FlowchartDriver;
  const ast = driver.parse('flowchart TD\n    A["Start"] --> B["End"]\n');

  // 1. Add link
  assert.equal(driver.mutations.getNodeLinkDetails?.(ast, 'A'), undefined);
  driver.mutations.setNodeLink?.(ast, 'A', {
    url: 'https://example.com',
    tooltip: 'Start Node Info',
    target: '_blank',
  });

  const details = driver.mutations.getNodeLinkDetails?.(ast, 'A');
  assert.deepEqual(details, {
    url: 'https://example.com',
    tooltip: 'Start Node Info',
    target: '_blank',
  });

  let serialized = driver.serialize(ast);
  assert.ok(serialized.includes('click A "https://example.com" "Start Node Info" _blank'));

  // 2. Edit link
  driver.mutations.setNodeLink?.(ast, 'A', {
    url: 'https://updated.com',
  });
  serialized = driver.serialize(ast);
  assert.ok(serialized.includes('click A "https://updated.com"'));
  assert.ok(!serialized.includes('https://example.com'));

  // 3. Delete link
  driver.mutations.setNodeLink?.(ast, 'A', null);
  serialized = driver.serialize(ast);
  assert.ok(!serialized.includes('click A'));
});

test('Phase 1: Sequence autonumber toggle mutation', () => {
  const driver = SequenceDiagramDriver;
  const ast = driver.parse('sequenceDiagram\n    Alice->>Bob: Hello\n');

  assert.equal(driver.mutations.isAutonumbered?.(ast), false);
  let serialized = driver.serialize(ast);
  assert.ok(!serialized.includes('autonumber'));

  // Toggle on
  driver.mutations.setAutonumbered?.(ast, true);
  assert.equal(driver.mutations.isAutonumbered?.(ast), true);
  serialized = driver.serialize(ast);
  assert.ok(serialized.includes('autonumber'));

  // Toggle off
  driver.mutations.setAutonumbered?.(ast, false);
  assert.equal(driver.mutations.isAutonumbered?.(ast), false);
  serialized = driver.serialize(ast);
  assert.ok(!serialized.includes('autonumber'));
});

test('Phase 1: Subgraph direction override in Flowchart & State diagrams', () => {
  // 1. Flowchart subgraph direction
  const fcDriver = FlowchartDriver;
  const fcAst = fcDriver.parse(
    'flowchart TD\n    subgraph Core ["Core Pipeline"]\n        A --> B\n    end\n'
  );
  assert.equal(fcDriver.mutations.getGroupDirection?.(fcAst, 'Core'), undefined);

  fcDriver.mutations.setGroupDirection?.(fcAst, 'Core', 'LR');
  assert.equal(fcDriver.mutations.getGroupDirection?.(fcAst, 'Core'), 'LR');

  let fcSerialized = fcDriver.serialize(fcAst);
  assert.ok(fcSerialized.includes('direction LR'));

  fcDriver.mutations.setGroupDirection?.(fcAst, 'Core', null);
  fcSerialized = fcDriver.serialize(fcAst);
  assert.ok(!fcSerialized.includes('direction LR'));

  // 2. State diagram composite direction
  const stDriver = StateDiagramDriver;
  const stAst = stDriver.parse(
    'stateDiagram-v2\n    state Processing {\n        [*] --> SubStep\n    }\n'
  );
  stDriver.mutations.setGroupDirection?.(stAst, 'Processing', 'LR');
  let stSerialized = stDriver.serialize(stAst);
  assert.ok(stSerialized.includes('direction LR'));
});

test('Phase 1: Diagram title mutation across drivers', () => {
  const drivers = [FlowchartDriver, SequenceDiagramDriver, StateDiagramDriver, ClassDiagramDriver, MindmapDriver];

  for (const driver of drivers) {
    const code = driver.createDefault();
    const ast = driver.parse(code);

    assert.equal(driver.mutations.getTitle?.(ast), undefined);

    // Set title
    driver.mutations.setTitle?.(ast, 'Architecture Overview');
    assert.equal(driver.mutations.getTitle?.(ast), 'Architecture Overview');

    const serialized = driver.serialize(ast);
    assert.ok(
      serialized.includes('title: Architecture Overview') ||
      serialized.includes('title: "Architecture Overview"'),
      `Driver ${driver.type} must emit frontmatter title`
    );

    // Reparse
    const reparsed = driver.parse(serialized);
    assert.equal(
      driver.mutations.getTitle?.(reparsed),
      'Architecture Overview',
      `Driver ${driver.type} must read title back after serialization`
    );

    // Remove title
    driver.mutations.setTitle?.(ast, null);
    assert.equal(driver.mutations.getTitle?.(ast), undefined);
  }
});
