import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { SequenceDiagramDriver } from '../src/diagrams/sequence/sequenceDriver';
import { setupClusterInteractivity } from '../src/canvas/interaction/clusterInteractivity';

const dom = new JSDOM('<!DOCTYPE html><html><body><div id="c"></div></body></html>');
(global as any).window = dom.window;
(global as any).document = dom.window.document;
(global as any).SVGElement = dom.window.SVGElement;
(global as any).Element = dom.window.Element;
(global as any).MouseEvent = dom.window.MouseEvent;
dom.window.SVGElement.prototype.getBBox = function () {
  return { x: 0, y: 0, width: 100, height: 100 };
};
(global as any).CSSStyleSheet = class CSSStyleSheet {
  cssRules = [];
  replaceSync() {}
  insertRule() {}
};
(dom.window.Element.prototype as any).setCssStyles = function (styles: Record<string, string>) {
  for (const k of Object.keys(styles || {})) {
    try { (this as any).style[k] = (styles as any)[k]; } catch {}
  }
};

const nullRect = () => null;

async function renderInto(code: string, renderId: string): Promise<HTMLElement> {
  const mermaid = (await import('mermaid')).default;
  mermaid.initialize({ startOnLoad: false });
  const { svg } = await mermaid.render(renderId, code);
  const mountEl = dom.window.document.createElement('div');
  mountEl.innerHTML = svg;
  return mountEl as unknown as HTMLElement;
}

test('Sequence diagram frames are selectable and bound to subgraphs', async () => {
  const code = `sequenceDiagram
    actor Alice
    participant Bob
    rect rgb(200, 220, 240)
        Alice->>Bob: Hello
    end
    loop Every 5s
        Alice->>Bob: Ping
    end
    opt Maybe
        Alice->>Bob: Ok
    end
`;

  const ast = SequenceDiagramDriver.parse(code);
  const proj = SequenceDiagramDriver.project(ast);

  assert.strictEqual(proj.subgraphs.size, 3);
  const frameIds = Array.from(proj.subgraphs.keys());
  assert.ok(frameIds[0].startsWith('frame_'));
  assert.ok(frameIds[1].startsWith('frame_'));
  assert.ok(frameIds[2].startsWith('frame_'));

  const mountEl = await renderInto(code, 'test_seq_frames_select');

  let selectedSubId: string | null = null;
  setupClusterInteractivity({
    mountEl,
    dom: SequenceDiagramDriver.dom,
    displaySubgraphs: proj.subgraphs,
    getLocalRect: nullRect,
    onSelectSubgraph: (id) => {
      selectedSubId = id;
    },
    onStartEditingSubgraph: () => {},
  });

  const boundClusters = mountEl.querySelectorAll('[data-mermaid-subgraph-id]');
  assert.strictEqual(boundClusters.length, 3);

  // Simulate clicking the first bound cluster
  const firstCluster = boundClusters[0] as HTMLElement;
  firstCluster.onclick?.(new dom.window.MouseEvent('click') as any);
  assert.strictEqual(selectedSubId, frameIds[0]);
});

test('Sequence diagram frames bind even without data-et attribute (Mermaid 10 / Obsidian)', async () => {
  const code = `sequenceDiagram
    actor Alice
    participant Bob
    loop Every 5s
        Alice->>Bob: Ping
    end
    opt Maybe
        Alice->>Bob: Ok
    end
`;

  const ast = SequenceDiagramDriver.parse(code);
  const proj = SequenceDiagramDriver.project(ast);

  const mountEl = await renderInto(code, 'test_seq_frames_no_data_et');
  // Strip data-et to simulate Obsidian Mermaid 10
  mountEl.querySelectorAll('[data-et]').forEach((el) => {
    el.removeAttribute('data-et');
  });

  let selectedSubId: string | null = null;
  setupClusterInteractivity({
    mountEl,
    dom: SequenceDiagramDriver.dom,
    displaySubgraphs: proj.subgraphs,
    getLocalRect: nullRect,
    onSelectSubgraph: (id) => {
      selectedSubId = id;
    },
    onStartEditingSubgraph: () => {},
  });

  const boundClusters = mountEl.querySelectorAll('[data-mermaid-subgraph-id]');
  assert.strictEqual(boundClusters.length, 2);

  // Test child clicks on the loop frame (frame_0)
  const loopCluster = boundClusters[0] as HTMLElement;

  // 1. Click polygon.labelBox
  selectedSubId = null;
  const labelBox = loopCluster.querySelector('polygon.labelBox') as HTMLElement;
  assert.ok(labelBox, 'labelBox polygon should exist');
  labelBox.onclick?.(new dom.window.MouseEvent('click') as any);
  assert.strictEqual(selectedSubId, 'frame_0', 'Clicking labelBox selects frame');

  // 2. Click line.loopLine
  selectedSubId = null;
  const loopLine = loopCluster.querySelector('line.loopLine') as HTMLElement;
  assert.ok(loopLine, 'loopLine should exist');
  loopLine.onclick?.(new dom.window.MouseEvent('click') as any);
  assert.strictEqual(selectedSubId, 'frame_0', 'Clicking loopLine selects frame');

  // 3. Click text.loopText
  selectedSubId = null;
  const loopText = loopCluster.querySelector('text.loopText') as HTMLElement;
  assert.ok(loopText, 'loopText should exist');
  loopText.onclick?.(new dom.window.MouseEvent('click') as any);
  assert.strictEqual(selectedSubId, 'frame_0', 'Clicking loopText selects frame');

  // 4. Click hit-area rect
  selectedSubId = null;
  const hitArea = loopCluster.querySelector('rect.mermaid-frame-hit-area') as HTMLElement;
  assert.ok(hitArea, 'hit-area rect should exist');
  hitArea.onclick?.(new dom.window.MouseEvent('click') as any);
  assert.strictEqual(selectedSubId, 'frame_0', 'Clicking hitArea selects frame');
});

