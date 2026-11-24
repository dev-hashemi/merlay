import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { getDriverForCode } from '../src/diagrams/registry';
import { mountMermaidSvg } from '../src/canvas/renderer/mermaidRenderer';
import { setupSvgInteractivity } from '../src/canvas/interaction/setupSvgInteractivity';
import { findNodeEditElement } from '../src/canvas/components/useOverlayDerivedState';
import { useCanvasCamera } from '../src/canvas/hooks/useCanvasCamera';
import { useCanvasSelection } from '../src/canvas/hooks/useCanvasSelection';

// Unmodified render() output from the renderer shipped in Obsidian 1.15.0.
// Fixtures keep the suite offline and add no runtime or development dependency.
const fixtures = JSON.parse(readFileSync(new URL('./fixtures/obsidianPele.json', import.meta.url), 'utf8')) as {
  diagrams: { type: string; code: string; svg: string }[];
};

function setup(type: string, prepare?: (mount: HTMLElement) => void) {
  const fixture = fixtures.diagrams.find((f) => f.type === type);
  assert.ok(fixture);
  const dom = new JSDOM('<!doctype html><html><body></body></html>');
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, DOMParser: dom.window.DOMParser, MouseEvent: dom.window.MouseEvent });
  const mount = dom.window.document.createElement('div');
  mountMermaidSvg(mount, fixture.svg);
  prepare?.(mount);
  const driver = getDriverForCode(fixture.code);
  const ast = driver.parse(fixture.code);
  const projection = driver.project(ast);
  const selected: string[] = [];
  const edited: string[] = [];
  const notes: string[] = [];
  const resolveEdge = setupSvgInteractivity({
    mountEl: mount, dom: driver.dom,
    displayNodes: projection.nodes, displayEdges: projection.edges, displaySubgraphs: projection.subgraphs,
    getLocalRect: () => null,
    onSelectNode: (id) => { selected.push(id); },
    onSelectEdge: (edge) => { selected.push(edge.id); },
    onSelectSubgraph: (id) => { selected.push(id); },
    onStartEditingNode: (id) => { edited.push(id); },
    onStartEditingEdge: (id) => { edited.push(id); },
    onStartEditingSubgraph: (id) => { edited.push(id); },
    onHoverNode: () => {},
    findNodeForNote: () => type === 'stateDiagram' ? 'Idle' : 'A',
    onSelectNote: (id) => { notes.push(id); },
  });
  const click = (el: Element, event = 'click') => el.dispatchEvent(new dom.window.MouseEvent(event, {
    // jsdom has zero-sized bboxes; avoid its artificial nearest-edge ties.
    bubbles: true, cancelable: true, clientX: 1000, clientY: 1000,
  }));
  return { mount, driver, ast, projection, selected, edited, notes, click, resolveEdge };
}

for (const type of ['flowchart', 'stateDiagram', 'sequenceDiagram', 'classDiagram']) {
  test(`Pele ${type}: duplicate node labels select and rename the intended AST node`, () => {
    const h = setup(type);
    const nodeId = type === 'stateDiagram' ? 'Busy' : 'B';
    const node = h.mount.querySelector(`.pele-node[data-id="${nodeId}"]:not(.pele-actor-footer)`);
    assert.ok(node);
    h.click(node);
    h.click(node, 'dblclick');
    assert.deepEqual(h.selected, [nodeId]);
    assert.deepEqual(h.edited, [nodeId]);
    h.driver.mutations.updateNodeLabel(h.ast, nodeId, 'Updated');
    const roundTrip = h.driver.project(h.driver.parse(h.driver.serialize(h.ast)));
    assert.equal(roundTrip.nodes.get(nodeId)?.label, 'Updated');
  });
}

test('Pele mindmap: implicit duplicate topics and the last-rendered root retain their AST identities', () => {
  const h = setup('mindmap');
  const nodes = h.mount.querySelectorAll('.pele-node');
  const expected = ['node_0', 'node_1', 'node_2', 'explicit', 'root'];
  assert.equal(nodes.length, expected.length);
  nodes.forEach((node) => h.click(node));
  assert.deepEqual(h.selected, expected);
  h.click(nodes[2], 'dblclick');
  assert.deepEqual(h.edited, ['node_2']);
  h.driver.mutations.updateNodeLabel(h.ast, 'node_2', 'Updated');
  const next = h.driver.project(h.driver.parse(h.driver.serialize(h.ast)));
  assert.equal(next.nodes.get('node_0')?.label, 'Same');
  assert.equal(next.nodes.get('node_2')?.label, 'Updated');
});

for (const type of ['flowchart', 'stateDiagram', 'sequenceDiagram', 'mindmap', 'classDiagram']) {
  test(`Pele ${type}: arrows bind once per edge and note connectors stay uneditable`, () => {
    const h = setup(type);
    const edges = h.mount.querySelectorAll('.pele-edge:not(.pele-note-edge)');
    edges.forEach((edge, i) => {
      const path = edge.matches('path') ? edge : edge.querySelector('path:not(.pele-marker)');
      assert.ok(path);
      assert.equal(h.resolveEdge(h.projection.edges[i].id), path);
      h.click(path);
      assert.equal(h.selected.at(-1), h.projection.edges[i].id);
    });
    assert.equal(h.mount.querySelectorAll('.mermaid-edge-hit-area').length, h.projection.edges.length);
    assert.equal(h.mount.querySelectorAll('.pele-marker[data-mermaid-edge-id], .pele-note-edge [data-mermaid-edge-id]').length, 0);
    const labels = h.mount.querySelectorAll('.pele-edge-label');
    labels.forEach((label) => {
      const group = Array.from(edges).find((edge) => edge.getAttribute('data-id') === label.getAttribute('data-id'));
      assert.ok(group);
      const expected = h.projection.edges[Array.from(edges).indexOf(group)].id;
      h.click(label, 'dblclick');
      assert.equal(h.edited.at(-1), expected);
    });
  });
}

test('Pele groups: equal labels bind to their explicit IDs, never their wrapper', () => {
  const h = setup('flowchart', (mount) => {
    const first = mount.querySelector('.pele-cluster[data-id="first"]')!;
    const second = mount.querySelector('.pele-cluster[data-id="second"]')!;
    first.parentElement!.insertBefore(first, second);
  });
  for (const id of ['first', 'second']) {
    const cluster = h.mount.querySelector(`.pele-cluster[data-id="${id}"]`);
    assert.ok(cluster);
    h.click(cluster);
    h.click(cluster, 'dblclick');
    assert.equal(h.selected.at(-1), id);
    assert.equal(h.edited.at(-1), id);
  }
  assert.equal(h.mount.querySelector('.pele-clusters')?.hasAttribute('data-mermaid-subgraph-id'), false);
});

test('Pele state: root and composite start/end anchors stay distinct', () => {
  const h = setup('stateDiagram');
  for (const [native, id, kind] of [
    ['root_start', '[*]', 'start'], ['root_end', '[*]', 'end'],
    ['Running_start', '[*]:Running', 'start'], ['Running_end', '[*]:Running', 'end'],
  ]) {
    const anchor = h.mount.querySelector(`[data-id="${native}"]`);
    assert.ok(anchor);
    h.click(anchor);
    assert.equal(h.selected.at(-1), id);
    assert.equal(anchor.getAttribute('data-mermaid-start-end'), kind);
  }
});

test('Pele sequence: boxes and same-title frames remain independently editable', () => {
  const h = setup('sequenceDiagram');
  const groups = h.mount.querySelectorAll('.pele-box, .pele-frame');
  groups.forEach((group) => h.click(group, 'dblclick'));
  assert.deepEqual(h.edited, ['box_1', 'frame_2', 'frame_5', 'frame_8']);
});

test('Pele sequence: lifelines select participants and editing targets their top header', () => {
  const h = setup('sequenceDiagram');
  const lifeline = h.mount.querySelector('.pele-lifeline[data-id="B"]');
  assert.ok(lifeline);
  h.click(lifeline);
  assert.deepEqual(h.selected, ['B']);
  const overlay = h.mount.querySelector('.mermaid-lifeline-hit-area[data-mermaid-node-id="B"]');
  assert.ok(overlay);
  assert.equal(overlay.getAttribute('d'), lifeline.getAttribute('d'));
  const header = findNodeEditElement(h.mount, 'B');
  assert.ok(header?.classList.contains('pele-actor'));
  assert.equal(header.classList.contains('pele-actor-footer'), false);
});

test('Legacy sequence: editing ignores selected halo copies and prefers the top header', () => {
  const dom = new JSDOM(`<svg>
    <rect class="actor actor-bottom" name="B" data-mermaid-node-id="B"/>
    <rect class="mermaid-node-selection-halo" name="B" data-mermaid-node-id="B"/>
    <text class="actor actor-box" data-mermaid-node-id="B">Bottom label</text>
    <rect id="header" class="actor actor-top" name="B" data-mermaid-node-id="B"/>
  </svg>`);
  const mount = dom.window.document.body;
  assert.equal(findNodeEditElement(mount, 'B'), mount.querySelector('#header'));
});

test('Pele sequence: camera pins the participant header when lifelines and footers move', async () => {
  const h = setup('sequenceDiagram');
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  let expanded = false;
  h.mount.querySelectorAll('[data-mermaid-node-id="B"]').forEach((el) => {
    el.getBoundingClientRect = () => new window.DOMRect(
      50, el.classList.contains('pele-actor-footer') ? (expanded ? 600 : 400) : 50,
      80, el.matches('.pele-lifeline, .mermaid-lifeline-hit-area') ? (expanded ? 500 : 300) : 50
    );
  });
  const world = document.createElement('div');
  world.append(h.mount);
  let camera: ReturnType<typeof useCanvasCamera> | undefined;
  function Probe() {
    camera = useCanvasCamera({ worldRef: { current: world }, svgMountRef: { current: h.mount } });
    return null;
  }
  const root = createRoot(document.createElement('div'));
  try {
    await act(async () => root.render(createElement(Probe)));
    assert.ok(camera);
    camera.pinNodeForCamera('B');
    expanded = true;
    await act(async () => camera?.stabilizeCamera());
    assert.deepEqual(camera.pan, { x: 0, y: 0 });
  } finally {
    await act(async () => root.unmount());
  }
});

test('Pele selection: selecting a participant highlights its bound SVG elements', async () => {
  const h = setup('sequenceDiagram');
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  let selection: ReturnType<typeof useCanvasSelection> | undefined;
  function Probe() {
    selection = useCanvasSelection({
      svgMountRef: { current: h.mount }, getLocalRect: () => null, displayDirection: 'LR',
    });
    return null;
  }
  const root = createRoot(document.createElement('div'));
  try {
    await act(async () => root.render(createElement(Probe)));
    await act(async () => selection?.setSelectedNodeId('B'));
    assert.equal(h.mount.querySelectorAll('.pele-actor[data-id="B"].mermaid-node-selected').length, 2);
    assert.ok(h.mount.querySelector('.pele-actor[data-id="B"] .mermaid-node-selection-halo'));
  } finally {
    await act(async () => { selection?.clearSelection(); root.unmount(); });
  }
});

for (const type of ['stateDiagram', 'sequenceDiagram', 'classDiagram']) {
  test(`Pele ${type}: clicking a note opens note editing without binding its wrapper as a note`, () => {
    const h = setup(type);
    const note = h.mount.querySelector('.pele-note');
    assert.ok(note);
    h.click(note);
    assert.deepEqual(h.notes, [type === 'stateDiagram' ? 'Idle' : 'A']);
    const wrapper = h.mount.querySelector('.pele-notes');
    if (wrapper) h.click(wrapper);
    assert.equal(h.notes.length, 1);
  });
}
