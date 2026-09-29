import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  parseDiagramAccessibility,
  updateDiagramAccessibility,
} from '../src/diagrams/common';
import { FlowchartDriver } from '../src/diagrams/flowchart/flowchartDriver';
import { SequenceDiagramDriver } from '../src/diagrams/sequence/sequenceDriver';
import { StateDiagramDriver } from '../src/diagrams/state/stateDriver';
import { ClassDiagramDriver } from '../src/diagrams/class/classDriver';

describe('Universal Diagram Accessibility (accTitle & accDescr)', () => {
  it('parses single-line accTitle and accDescr', () => {
    const rawLines = [
      { type: 'raw', text: 'accTitle: Architecture Flow' },
      { type: 'raw', text: 'accDescr: Microservices data flow overview' },
    ];
    const acc = parseDiagramAccessibility(rawLines);
    assert.strictEqual(acc.accTitle, 'Architecture Flow');
    assert.strictEqual(acc.accDescr, 'Microservices data flow overview');
  });

  it('parses multi-line accDescr { ... } blocks', () => {
    const rawLines = [
      { type: 'raw', text: 'accTitle: Complex Flow' },
      { type: 'raw', text: 'accDescr {' },
      { type: 'raw', text: '    Line 1 of description' },
      { type: 'raw', text: '    Line 2 of description' },
      { type: 'raw', text: '}' },
    ];
    const acc = parseDiagramAccessibility(rawLines);
    assert.strictEqual(acc.accTitle, 'Complex Flow');
    assert.strictEqual(acc.accDescr, 'Line 1 of description\nLine 2 of description');
  });

  it('updates accessibility in Flowchart AST', () => {
    const code = `flowchart TD
    A --> B
`;
    const ast = FlowchartDriver.parse(code);
    assert.deepStrictEqual(FlowchartDriver.mutations.getAccessibility?.(ast), {});

    FlowchartDriver.mutations.setAccessibility?.(ast, {
      accTitle: 'System Flow',
      accDescr: 'Shows components interacting',
    });

    const parsed = FlowchartDriver.mutations.getAccessibility?.(ast);
    assert.strictEqual(parsed?.accTitle, 'System Flow');
    assert.strictEqual(parsed?.accDescr, 'Shows components interacting');

    const serialized = FlowchartDriver.serialize(ast);
    assert.match(serialized, /accTitle:\s*System Flow/);
    assert.match(serialized, /accDescr:\s*Shows components interacting/);

    // Reparse
    const reparsedAst = FlowchartDriver.parse(serialized);
    const reparsedAcc = FlowchartDriver.mutations.getAccessibility?.(reparsedAst);
    assert.strictEqual(reparsedAcc?.accTitle, 'System Flow');
    assert.strictEqual(reparsedAcc?.accDescr, 'Shows components interacting');
  });

  it('updates multi-line accessibility in Sequence AST', () => {
    const code = `sequenceDiagram
    Alice->>Bob: Hello
`;
    const ast = SequenceDiagramDriver.parse(code);

    SequenceDiagramDriver.mutations.setAccessibility?.(ast, {
      accTitle: 'Auth Flow',
      accDescr: 'Step 1: Handshake\nStep 2: Verification',
    });

    const serialized = SequenceDiagramDriver.serialize(ast);
    assert.match(serialized, /accTitle:\s*Auth Flow/);
    assert.match(serialized, /accDescr\s*\{[\s\S]*Step 1: Handshake[\s\S]*Step 2: Verification[\s\S]*\}/);

    // Clear accessibility
    SequenceDiagramDriver.mutations.setAccessibility?.(ast, null);
    const cleared = SequenceDiagramDriver.serialize(ast);
    assert.doesNotMatch(cleared, /accTitle/);
    assert.doesNotMatch(cleared, /accDescr/);
  });

  it('updates accessibility in Class diagram AST', () => {
    const code = `classDiagram
    class User
`;
    const ast = ClassDiagramDriver.parse(code);

    ClassDiagramDriver.mutations.setAccessibility?.(ast, {
      accTitle: 'Domain Model',
      accDescr: 'Core user entity relationships',
    });

    const serialized = ClassDiagramDriver.serialize(ast);
    assert.match(serialized, /accTitle:\s*Domain Model/);
    assert.match(serialized, /accDescr:\s*Core user entity relationships/);
  });

  it('updates accessibility in State diagram AST', () => {
    const code = `stateDiagram-v2
    [*] --> Idle
`;
    const ast = StateDiagramDriver.parse(code);

    StateDiagramDriver.mutations.setAccessibility?.(ast, {
      accTitle: 'Lifecycle',
    });

    const serialized = StateDiagramDriver.serialize(ast);
    assert.match(serialized, /accTitle:\s*Lifecycle/);
  });
});
