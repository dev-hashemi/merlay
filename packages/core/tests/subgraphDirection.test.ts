import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { FlowchartDriver } from '../src/diagrams/flowchart/flowchartDriver';
import { StateDiagramDriver } from '../src/diagrams/state/stateDriver';
import { getNextGroupDirection } from '../src/canvas/hooks/mutations/useSubgraphMutations';

// Setup DOM mock for mermaid.render
const dom = new JSDOM('<!DOCTYPE html><html><body><div id="container"></div></body></html>');
(global as any).window = dom.window;
(global as any).document = dom.window.document;
(global as any).SVGElement = dom.window.SVGElement;
dom.window.SVGElement.prototype.getBBox = () => ({ x: 0, y: 0, width: 100, height: 100 });
(global as any).CSSStyleSheet = class CSSStyleSheet {
  cssRules = [];
  replaceSync() {}
  insertRule() {}
};

test('getNextGroupDirection: cycles correctly based on parent diagram direction', () => {
  // 1. Horizontal diagram (flowchart LR / stateDiagram LR)
  // Auto (LR) -> TB (opposite, visual flip!) -> LR (explicit) -> Auto (clear override)
  assert.equal(getNextGroupDirection(undefined, 'LR'), 'TB');
  assert.equal(getNextGroupDirection('TB', 'LR'), 'LR');
  assert.equal(getNextGroupDirection('LR', 'LR'), undefined);

  // 2. Vertical diagram (flowchart TD / TB)
  // Auto (TD) -> LR (opposite, visual flip!) -> TB (explicit) -> Auto (clear override)
  assert.equal(getNextGroupDirection(undefined, 'TD'), 'LR');
  assert.equal(getNextGroupDirection('LR', 'TD'), 'TB');
  assert.equal(getNextGroupDirection('TB', 'TD'), undefined);

  // 3. State diagram with default (no explicit direction = TB in Mermaid)
  assert.equal(getNextGroupDirection(undefined, undefined), 'LR');
  assert.equal(getNextGroupDirection('LR', undefined), 'TB');
  assert.equal(getNextGroupDirection('TB', undefined), undefined);
});

test('Flowchart: toggling subgraph direction updates AST and serializes cleanly', () => {
  const driver = FlowchartDriver;
  const code = [
    'flowchart LR',
    '    subgraph ServiceAlpha ["Service Alpha"]',
    '        A["Step 1"] --> B["Step 2"]',
    '    end',
  ].join('\n');

  const ast = driver.parse(code);
  const subId = 'ServiceAlpha';

  // Initially Auto (no local override)
  assert.equal(driver.mutations.getGroupDirection?.(ast, subId), undefined);

  // Toggle 1: switches to TB (opposite of diagram LR)
  const next1 = getNextGroupDirection(
    driver.mutations.getGroupDirection?.(ast, subId),
    driver.mutations.getDirection(ast)
  );
  assert.equal(next1, 'TB');
  driver.mutations.setGroupDirection?.(ast, subId, next1);
  assert.equal(driver.mutations.getGroupDirection?.(ast, subId), 'TB');

  let serialized = driver.serialize(ast);
  assert.match(serialized, /subgraph ServiceAlpha[\s\S]*direction TB/);

  // Toggle 2: switches to LR (explicit same as diagram)
  const next2 = getNextGroupDirection(
    driver.mutations.getGroupDirection?.(ast, subId),
    driver.mutations.getDirection(ast)
  );
  assert.equal(next2, 'LR');
  driver.mutations.setGroupDirection?.(ast, subId, next2);
  assert.equal(driver.mutations.getGroupDirection?.(ast, subId), 'LR');

  serialized = driver.serialize(ast);
  assert.match(serialized, /subgraph ServiceAlpha[\s\S]*direction LR/);

  // Toggle 3: clears override back to Auto
  const next3 = getNextGroupDirection(
    driver.mutations.getGroupDirection?.(ast, subId),
    driver.mutations.getDirection(ast)
  );
  assert.equal(next3, undefined);
  driver.mutations.setGroupDirection?.(ast, subId, next3);
  assert.equal(driver.mutations.getGroupDirection?.(ast, subId), undefined);

  serialized = driver.serialize(ast);
  assert.doesNotMatch(serialized, /direction (TB|LR)/);
});

test('State diagram: composite state direction projection and serialization roundtrip', () => {
  const driver = StateDiagramDriver;
  const code = [
    'stateDiagram-v2',
    '    direction LR',
    '    state "Processing Step" as Processing {',
    '        Idle --> Active',
    '    }',
  ].join('\n');

  const ast = driver.parse(code);
  const compId = 'Processing';

  // Projection reflects actual override on the composite state, not synthetic fallback
  let projection = driver.project(ast);
  let sub = projection.subgraphs.get(compId);
  assert.equal(sub?.direction, undefined, 'initial composite state must have undefined direction override');

  // Toggle 1: switches to TB (opposite of diagram LR)
  const next1 = getNextGroupDirection(
    driver.mutations.getGroupDirection?.(ast, compId),
    driver.mutations.getDirection(ast)
  );
  assert.equal(next1, 'TB');
  driver.mutations.setGroupDirection?.(ast, compId, next1);

  projection = driver.project(ast);
  sub = projection.subgraphs.get(compId);
  assert.equal(sub?.direction, 'TB');

  let serialized = driver.serialize(ast);
  assert.match(serialized, /state "Processing Step" as Processing \{[\s\S]*direction TB/);

  // Toggle 2: switches to LR
  const next2 = getNextGroupDirection(
    driver.mutations.getGroupDirection?.(ast, compId),
    driver.mutations.getDirection(ast)
  );
  assert.equal(next2, 'LR');
  driver.mutations.setGroupDirection?.(ast, compId, next2);

  projection = driver.project(ast);
  sub = projection.subgraphs.get(compId);
  assert.equal(sub?.direction, 'LR');

  serialized = driver.serialize(ast);
  assert.match(serialized, /state "Processing Step" as Processing \{[\s\S]*direction LR/);

  // Toggle 3: clears override back to Auto
  const next3 = getNextGroupDirection(
    driver.mutations.getGroupDirection?.(ast, compId),
    driver.mutations.getDirection(ast)
  );
  assert.equal(next3, undefined);
  driver.mutations.setGroupDirection?.(ast, compId, next3);

  projection = driver.project(ast);
  sub = projection.subgraphs.get(compId);
  assert.equal(sub?.direction, undefined);

  serialized = driver.serialize(ast);
  assert.doesNotMatch(serialized, /state "Processing Step" as Processing \{[\s\S]*direction/);
});

test('Mermaid rendering: composite state layout changes between LR and TB', async () => {
  const mermaid = (await import('mermaid')).default;
  mermaid.initialize({ startOnLoad: false });

  const lrCode = [
    'stateDiagram-v2',
    '    state Comp1 {',
    '        direction LR',
    '        StateA --> StateB',
    '    }',
  ].join('\n');

  const tbCode = [
    'stateDiagram-v2',
    '    state Comp1 {',
    '        direction TB',
    '        StateA --> StateB',
    '    }',
  ].join('\n');

  const { svg: lrSvg } = await mermaid.render('test_comp_lr', lrCode);
  const { svg: tbSvg } = await mermaid.render('test_comp_tb', tbCode);

  assert.ok(lrSvg.length > 0);
  assert.ok(tbSvg.length > 0);

  const getTransforms = (svg: string) => {
    const a = svg.match(/id="[^"]*StateA-[^"]*"[^>]*transform="([^"]+)"/);
    const b = svg.match(/id="[^"]*StateB-[^"]*"[^>]*transform="([^"]+)"/);
    return { A: a ? a[1] : null, B: b ? b[1] : null };
  };

  const lrPos = getTransforms(lrSvg);
  const tbPos = getTransforms(tbSvg);

  assert.ok(lrPos.A && lrPos.B, 'LR nodes must be rendered');
  assert.ok(tbPos.A && tbPos.B, 'TB nodes must be rendered');

  // In LR, horizontal positions differ while vertical positions match
  assert.notEqual(lrPos.A, tbPos.A, 'Node coordinates must reflect directional layout');
});
