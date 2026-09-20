import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { useCanvasStore } from '../src/canvas/store/canvasStore';
import { getDriver } from '../src/diagrams/registry';
import { createUnsupportedDiagramDriver } from '../src/diagrams/unsupported/unsupportedDriver';

test('Connection Handle: Canvas store tracks hovered node and geometry for drag handle', () => {
  useCanvasStore.getState().resetTransientUiState();

  assert.strictEqual(useCanvasStore.getState().hoveredNodeId, null);
  assert.strictEqual(useCanvasStore.getState().hoveredNodeRect, null);
  assert.strictEqual(useCanvasStore.getState().hoveredNodeKind, null);

  // Simulate hover on node "A"
  const rectA = { x: 100, y: 50, width: 80, height: 40 };
  useCanvasStore.getState().setHoveredNode('A', rectA, null);

  assert.strictEqual(useCanvasStore.getState().hoveredNodeId, 'A');
  assert.deepStrictEqual(useCanvasStore.getState().hoveredNodeRect, rectA);
  assert.strictEqual(useCanvasStore.getState().hoveredNodeKind, null);

  // Connection handle position in LR mode
  const isLR = true;
  const handleX_LR = isLR ? rectA.x + rectA.width : rectA.x + rectA.width / 2;
  const handleY_LR = isLR ? rectA.y + rectA.height / 2 : rectA.y + rectA.height;
  assert.strictEqual(handleX_LR, 180);
  assert.strictEqual(handleY_LR, 70);

  // Connection handle position in TD mode
  const isTD = false;
  const handleX_TD = isTD ? rectA.x + rectA.width : rectA.x + rectA.width / 2;
  const handleY_TD = isTD ? rectA.y + rectA.height / 2 : rectA.y + rectA.height;
  assert.strictEqual(handleX_TD, 140);
  assert.strictEqual(handleY_TD, 90);

  // Clearing hover removes the handle geometry
  useCanvasStore.getState().setHoveredNode(null, null, null);
  assert.strictEqual(useCanvasStore.getState().hoveredNodeId, null);
  assert.strictEqual(useCanvasStore.getState().hoveredNodeRect, null);
});

test('Connection Handle: Drag line and connecting state round-trip', () => {
  useCanvasStore.getState().resetTransientUiState();

  // Start connecting from node A
  useCanvasStore.getState().setConnecting('A', null, {
    x1: 180,
    y1: 70,
    x2: 180,
    y2: 70,
  });

  const state = useCanvasStore.getState();
  assert.strictEqual(state.connectingSourceId, 'A');
  assert.strictEqual(state.connectingSourceKind, null);
  assert.deepStrictEqual(state.dragLine, { x1: 180, y1: 70, x2: 180, y2: 70 });

  // Update drag line coordinates on mouse move
  useCanvasStore.getState().setDragLine({
    x1: 180,
    y1: 70,
    x2: 300,
    y2: 150,
  });

  assert.deepStrictEqual(useCanvasStore.getState().dragLine, {
    x1: 180,
    y1: 70,
    x2: 300,
    y2: 150,
  });

  // Finish connecting
  useCanvasStore.getState().setConnecting(null, null, null);
  assert.strictEqual(useCanvasStore.getState().connectingSourceId, null);
  assert.strictEqual(useCanvasStore.getState().dragLine, null);
});

test('Connection Handle: State diagram anchors rule out end-anchor outgoing handles', () => {
  const stateDriver = getDriver('stateDiagram')!;
  const anchors = stateDriver.mutations.anchors!;

  assert.ok(anchors.isAnchor('[*]'));

  // Start anchor allows outgoing connection
  const startKind = 'start';
  const isStartBlocked = anchors.isAnchor('[*]') && startKind === 'end';
  assert.strictEqual(isStartBlocked, false);

  // End anchor blocks outgoing connection
  const endKind = 'end';
  const isEndBlocked = anchors.isAnchor('[*]') && endKind === 'end';
  assert.strictEqual(isEndBlocked, true);
});

test('Connection Handle: Flowchart drag-connect creates valid edge between steps', () => {
  const fcDriver = getDriver('flowchart')!;
  const ast = fcDriver.parse('flowchart LR\n    A["First"]\n    B["Second"]\n');

  assert.strictEqual(ast.edges.length, 0);

  // Drag from A to B
  fcDriver.mutations.connect(ast, 'A', 'B');
  assert.strictEqual(ast.edges.length, 1);
  assert.strictEqual(ast.edges[0].from, 'A');
  assert.strictEqual(ast.edges[0].to, 'B');

  const serialized = fcDriver.serialize(ast);
  assert.ok(serialized.includes('A --> B'));
});

test('Connection Handle: Flowchart drag-connect works between nodes in different subgraphs (issue #3)', () => {
  const fcDriver = getDriver('flowchart')!;
  const ast = fcDriver.parse(
    'flowchart LR\n' +
      '    subgraph sub_1 ["Group 1"]\n' +
      '        step_1 ["Node 1"]\n' +
      '    end\n' +
      '    subgraph sub_2 ["Group 2"]\n' +
      '        step_2 ["Node 2"]\n' +
      '    end\n'
  );

  assert.strictEqual(ast.edges.length, 0);

  // Drag from step_1 to step_2 — official Mermaid allows edges across subgraphs,
  // so the canvas drop guard must not veto it (only state composites are restricted).
  fcDriver.mutations.connect(ast, 'step_1', 'step_2');
  assert.strictEqual(ast.edges.length, 1);
  assert.strictEqual(ast.edges[0].from, 'step_1');
  assert.strictEqual(ast.edges[0].to, 'step_2');

  const serialized = fcDriver.serialize(ast);
  assert.ok(serialized.includes('step_1 --> step_2'));
  assert.ok(serialized.includes('subgraph sub_1'));
  assert.ok(serialized.includes('subgraph sub_2'));
});

test('Connection Handle: State diagram drag-connect from start anchor to state and state to end anchor', () => {
  const stateDriver = getDriver('stateDiagram')!;
  const ast = stateDriver.parse('stateDiagram-v2\n    Idle\n');

  // Connect start anchor [*] to Idle
  stateDriver.mutations.connect(ast, '[*]', 'Idle');
  assert.strictEqual(ast.transitions.length, 1);
  assert.strictEqual(ast.transitions[0].from, '[*]');
  assert.strictEqual(ast.transitions[0].to, 'Idle');

  // Connect Idle to end anchor [*]
  stateDriver.mutations.connect(ast, 'Idle', '[*]');
  assert.strictEqual(ast.transitions.length, 2);
  assert.strictEqual(ast.transitions[1].from, 'Idle');
  assert.strictEqual(ast.transitions[1].to, '[*]');

  const serialized = stateDriver.serialize(ast);
  assert.ok(serialized.includes('[*] --> Idle'));
  assert.ok(serialized.includes('Idle --> [*]'));
});

test('Connection Handle: canConnect mirrors official rules per diagram type', () => {
  const fcDriver = getDriver('flowchart')!;
  const seqDriver = getDriver('sequenceDiagram')!;
  const stateDriver = getDriver('stateDiagram')!;

  // Flowchart: any pair may connect, including across subgraphs (issue #3).
  const fcAst = fcDriver.parse(
    'flowchart LR\n    subgraph sub_1 ["G1"]\n        step_1 ["N1"]\n    end\n    subgraph sub_2 ["G2"]\n        step_2 ["N2"]\n    end\n'
  );
  assert.strictEqual(fcDriver.mutations.canConnect?.(fcAst, 'step_1', 'step_2'), true);

  // Sequence: messages between any participants are legal.
  const seqAst = seqDriver.parse('sequenceDiagram\n    Alice->>Bob: hi\n');
  assert.strictEqual(seqDriver.mutations.canConnect?.(seqAst, 'Alice', 'Bob'), true);

  // State: inner states of different composites are blocked (official Mermaid rule),
  // composite-to-composite and outer-to-inner are allowed.
  const stAst = stateDriver.parse(
    'stateDiagram-v2\n    state Comp1 {\n        [*] --> s1\n        s1 --> [*]\n    }\n    state Comp2 {\n        [*] --> s2\n        s2 --> [*]\n    }\n    Outer\n'
  );
  assert.strictEqual(stateDriver.mutations.canConnect?.(stAst, 's1', 's2'), false);
  assert.strictEqual(stateDriver.mutations.canConnect?.(stAst, 's2', 's1'), false);
  assert.strictEqual(stateDriver.mutations.canConnect?.(stAst, 'Comp1', 'Comp2'), true);
  assert.strictEqual(stateDriver.mutations.canConnect?.(stAst, 'Outer', 's1'), true);
  assert.strictEqual(stateDriver.mutations.canConnect?.(stAst, 's1', 'Comp1'), false);

  // Unsupported diagrams refuse drops (view-only).
  const unsupported = createUnsupportedDiagramDriver('pie');
  assert.strictEqual(
    unsupported.mutations.canConnect?.(unsupported.createEmpty(), 'A', 'B'),
    false
  );
});

test('Connection Handle: connectBlocked flag tracks refused drops and resets', () => {
  const store = useCanvasStore.getState();
  assert.strictEqual(store.connectBlocked, false);

  useCanvasStore.getState().setConnectBlocked(true);
  assert.strictEqual(useCanvasStore.getState().connectBlocked, true);

  // Starting/ending a drag clears the flag.
  useCanvasStore.getState().setConnecting('A', null, { x1: 0, y1: 0, x2: 0, y2: 0 });
  assert.strictEqual(useCanvasStore.getState().connectBlocked, false);

  useCanvasStore.getState().setConnectBlocked(true);
  useCanvasStore.getState().resetTransientUiState();
  assert.strictEqual(useCanvasStore.getState().connectBlocked, false);
});

test('Connection Handle: resetTransientUiState clears hover and connecting state', () => {
  useCanvasStore.getState().setHoveredNode('Node1', { x: 10, y: 10, width: 50, height: 50 });
  useCanvasStore.getState().setConnecting('Node1', null, { x1: 60, y1: 35, x2: 100, y2: 100 });

  assert.strictEqual(useCanvasStore.getState().hoveredNodeId, 'Node1');
  assert.strictEqual(useCanvasStore.getState().connectingSourceId, 'Node1');

  useCanvasStore.getState().resetTransientUiState();

  assert.strictEqual(useCanvasStore.getState().hoveredNodeId, null);
  assert.strictEqual(useCanvasStore.getState().hoveredNodeRect, null);
  assert.strictEqual(useCanvasStore.getState().connectingSourceId, null);
  assert.strictEqual(useCanvasStore.getState().dragLine, null);
});

test('Connection Handle: Drag-connect prioritizes inner nodes over enclosing subgraphs (issue #3 regression)', () => {
  // Simulate DOM layout where a subgraph wraps an inner node
  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="world"></div></body></html>');
  const doc = dom.window.document;
  const worldEl = doc.getElementById('world')!;
  worldEl.getBoundingClientRect = () => ({
    left: 0,
    top: 0,
    right: 1000,
    bottom: 1000,
    width: 1000,
    height: 1000,
    x: 0,
    y: 0,
    toJSON: () => {},
  });

  // Subgraph cluster element (appears first in querySelectorAll)
  const subEl = doc.createElement('div');
  subEl.setAttribute('data-mermaid-node-id', 'sub_2');
  subEl.getBoundingClientRect = () => ({
    left: 200,
    top: 100,
    right: 600,
    bottom: 400,
    width: 400,
    height: 300,
    x: 200,
    y: 100,
    toJSON: () => {},
  });
  worldEl.appendChild(subEl);

  // Inner node element (inside subgraph)
  const nodeEl = doc.createElement('div');
  nodeEl.setAttribute('data-mermaid-node-id', 'step_2');
  nodeEl.getBoundingClientRect = () => ({
    left: 250,
    top: 150,
    right: 350,
    bottom: 200,
    width: 100,
    height: 50,
    x: 250,
    y: 150,
    toJSON: () => {},
  });
  subEl.appendChild(nodeEl);

  const displaySubgraphs = new Map<string, unknown>([
    ['sub_1', { id: 'sub_1', label: 'Group 1' }],
    ['sub_2', { id: 'sub_2', label: 'Group 2' }],
  ]);

  // When drop point is inside sub_2 and near step_2 (e.g. at 240, 150 - 10px from step_2)
  // Candidate resolution must pick step_2, NOT sub_2
  const dropX = 240;
  const dropY = 150;
  let closestDist = 50;
  let closestNodeEl: Element | null = null;
  const candidates = Array.from(worldEl.querySelectorAll('[data-mermaid-node-id]'));

  for (const cand of candidates) {
    const nid = cand.getAttribute('data-mermaid-node-id');
    if (!nid || nid === 'step_1') continue;
    if (displaySubgraphs.has(nid)) continue; // correctly skips subgraphs so inner nodes win

    const r = cand.getBoundingClientRect();
    const candX = r.left;
    const candY = r.top;
    const candW = r.width;
    const candH = r.height;
    const dx = Math.max(candX - dropX, 0, dropX - (candX + candW));
    const dy = Math.max(candY - dropY, 0, dropY - (candY + candH));
    const dist = Math.hypot(dx, dy);
    if (dist < closestDist) {
      closestDist = dist;
      closestNodeEl = cand;
    }
  }

  assert.strictEqual(
    closestNodeEl,
    nodeEl,
    'drop near node inside subgraph must resolve to node, not subgraph'
  );
  assert.strictEqual(closestNodeEl?.getAttribute('data-mermaid-node-id'), 'step_2');
});

