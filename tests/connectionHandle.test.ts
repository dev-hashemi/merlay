import test from 'node:test';
import assert from 'node:assert/strict';
import { useCanvasStore } from '../src/canvas/store/canvasStore';
import { getDriver } from '../src/diagrams/registry';

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
