import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { setupEdgeInteractivity } from '../src/canvas/interaction/edgeInteractivity';
import { getDriverForCode } from '../src/diagrams/registry';
import type { MermaidEdgeDef, MermaidNodeDef } from '../src/diagrams/viewModel';
import type { SvgDomAdapter } from '../src/diagrams/types';

function bind(svg: string, dom: SvgDomAdapter, edges: MermaidEdgeDef[], nodes: Map<string, MermaidNodeDef>) {
  const { window } = new JSDOM(`<div><svg>${svg}</svg></div>`);
  Object.assign(globalThis, { window, document: window.document, Element: window.Element });
  return setupEdgeInteractivity({
    mountEl: window.document.querySelector('div')!, dom,
    displayEdges: edges, displayNodes: nodes,
    onSelectEdge: () => {}, onStartEditingEdge: () => {},
  });
}

function paths(ids: string[], classes: string): string {
  return ids.map((id) =>
    `<path id="render-${id}" data-id="${id}" class="${classes}" d="M0 0 L10 0"/>`
  ).join('');
}

// Stub only geometry. These are the IDs and classes emitted by bundled Mermaid.
test('Mermaid flowchart parallel arrows use the renderer ordinal even when suffixes skip numbers', () => {
  const code = 'flowchart LR\n A --> B\n B --> C';
  const driver = getDriverForCode(code);
  const ast = driver.parse(code);
  const id = driver.mutations.connect(ast, 'A', 'B')!;
  const { edges, nodes } = driver.project(ast);
  const resolve = bind(paths(['L_A_B_2', 'L_B_C_0', 'L_A_B_0'], 'flowchart-link'), driver.dom, edges, nodes);
  assert.equal(resolve(id)?.getAttribute('data-id'), 'L_A_B_2');
});

test('Mermaid class parallel relationships use the native relation ordinal', () => {
  const code = 'classDiagram\n A <|-- B\n B <|-- C';
  const driver = getDriverForCode(code);
  const ast = driver.parse(code);
  const id = driver.mutations.connect(ast, 'A', 'B')!;
  const { edges, nodes } = driver.project(ast);
  const resolve = bind(paths(['id_A_B_1', 'id_B_C_2', 'id_A_B_3'], 'relation'), driver.dom, edges, nodes);
  assert.equal(resolve(id)?.getAttribute('data-id'), 'id_A_B_3');
});

test('Mermaid state transitions use the emitted order after an inner transition is inserted', () => {
  const code = 'stateDiagram-v2\n Outside --> Finish\n state Box {\n  A --> B: Existing\n }';
  const driver = getDriverForCode(code);
  const ast = driver.parse(code);
  const id = driver.mutations.connect(ast, 'A', 'B')!;
  const edgeOrder: string[] = [];
  const serialized = driver.serialize(ast, edgeOrder);
  const transitions = driver.project(driver.parse(serialized)).edges;
  assert.deepEqual(transitions.map(({ from, to, label }) => [from, to, label]), [
    ['A', 'B', undefined], ['A', 'B', 'Existing'], ['Outside', 'Finish', undefined],
  ]);
  const { edges, nodes } = driver.project(ast);
  const resolve = bind(paths(['edge2', 'edge0', 'edge1'], 'transition'), driver.dom, edges, nodes);
  assert.equal(resolve(id, edgeOrder)?.getAttribute('data-id'), 'edge0');
});

test('Mermaid sequence highlights the inserted occurrence of a repeated message', () => {
  const code = 'sequenceDiagram\n A->>B: Message\n Note over A,B: note\n A->>B: Message';
  const driver = getDriverForCode(code);
  const ast = driver.parse(code);
  const id = driver.mutations.connect(ast, 'A', 'B', { insertAtIndex: 2 })!;
  const { edges, nodes } = driver.project(ast);
  assert.equal(edges[1].id, id);
  const resolve = bind(
    '<line x1="0" class="messageLine0" data-id="i0"/><path class="loopLine" d="M0 0"/>' +
    '<line x1="0" class="messageLine0" data-id="i3"/><line x1="0" class="messageLine0" data-id="i5"/>',
    driver.dom, edges, nodes
  );
  assert.equal(resolve(id)?.getAttribute('data-id'), 'i3');
});

test('Mermaid mindmap identifies the new parent–child branch after reparenting', () => {
  const code = 'mindmap\n  root((Root))\n    A[Branch]\n    B[Topic]\n    C[Topic]';
  const driver = getDriverForCode(code);
  const ast = driver.parse(code);
  const id = driver.mutations.connect(ast, 'A', 'B')!;
  const { edges, nodes } = driver.project(ast);
  const resolve = bind(paths(['edge_0_1', 'edge_0_3', 'edge_1_2'], 'edge'), driver.dom, edges, nodes);
  assert.equal(resolve(id)?.getAttribute('data-id'), 'edge_1_2');
});

test('missing parallel ordinals and fuzzy position matches cannot trigger a cue', () => {
  const driver = getDriverForCode('flowchart LR\n A --> B\n A --> B');
  const { edges, nodes } = driver.project(driver.parse('flowchart LR\n A --> B\n A --> B'));
  const resolve = bind(paths(['L_A_B_0'], 'flowchart-link LS_A LE_B') +
    paths(['unidentified'], 'flowchart-link LS_A LE_B'), driver.dom, edges, nodes);
  assert.equal(resolve(edges[1].id), null);
});
