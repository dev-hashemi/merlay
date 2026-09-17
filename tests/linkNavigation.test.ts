import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { FlowchartDriver } from '../src/diagrams/flowchart/flowchartDriver';
import { SequenceDiagramDriver } from '../src/diagrams/sequence/sequenceDriver';
import { setupNodeInteractivity } from '../src/canvas/interaction/nodeInteractivity';

// DOM harness for mermaid.render (mirrors clusterBinding.test.ts)
const dom = new JSDOM('<!DOCTYPE html><html><body><div id="c"></div></html>');
(global as any).window = dom.window;
(global as any).document = dom.window.document;
(global as any).SVGElement = dom.window.SVGElement;
(global as any).Element = dom.window.Element;
(dom.window.SVGElement.prototype as any).getBBox = () => ({
  x: 0,
  y: 0,
  width: 10,
  height: 10,
});
(global as any).CSSStyleSheet = class CSSStyleSheet {
  cssRules = [];
  replaceSync() {}
  insertRule() {}
};
// Obsidian runtime globals used by the interactivity setup
(dom.window.Element.prototype as any).setCssStyles = function (
  styles: Record<string, string>
) {
  for (const k of Object.keys(styles || {})) {
    try {
      (this as any).style[k] = (styles as any)[k];
    } catch {
      /* ignore */
    }
  }
};
(global as any).createSvg = (tag: string) =>
  dom.window.document.createElementNS('http://www.w3.org/2000/svg', tag);

const nullRect = () => null;

async function renderInto(code: string, renderId: string): Promise<HTMLElement> {
  const mermaid = (await import('mermaid')).default;
  mermaid.initialize({ startOnLoad: false });
  const { svg } = await mermaid.render(renderId, code);
  const mountEl = dom.window.document.createElement('div');
  mountEl.innerHTML = svg;
  return mountEl as unknown as HTMLElement;
}

test('Link navigation: clicking a linked flowchart node selects without navigating', async () => {
  const code =
    'flowchart LR\n    step_1["google"]\n    click step_1 "https://google.com"\n';
  const proj = FlowchartDriver.project(FlowchartDriver.parse(code));
  const mountEl = await renderInto(code, 'test_link_flowchart');

  // Sanity: mermaid really wraps the node in an anchor — without suppression
  // this click would navigate away from the editor.
  const nodeEl = mountEl.querySelector('[data-mermaid-node-id="step_1"], #test_link_flowchart-flowchart-step_1-0');
  const anchor = (nodeEl as Element | null)?.closest?.('a') ?? mountEl.querySelector('a[href*="google.com"]');
  assert.ok(anchor, 'expected mermaid to render a link around the node');

  const selected: string[] = [];
  setupNodeInteractivity({
    mountEl: mountEl as any,
    dom: FlowchartDriver.dom as any,
    displayNodes: proj.nodes as any,
    displaySubgraphs: proj.subgraphs as any,
    getLocalRect: nullRect as any,
    onSelectNode: (id: string) => {
      selected.push(id);
    },
    onSelectSubgraph: () => {},
    onStartEditingNode: () => {},
    onStartEditingSubgraph: () => {},
    onHoverNode: () => {},
  });

  const bound = mountEl.querySelector('[data-mermaid-node-id="step_1"]');
  assert.ok(bound, 'expected the linked node to bind for selection');
  const evt = new dom.window.MouseEvent('click', { bubbles: true, cancelable: true });
  (bound as unknown as Element).dispatchEvent(evt);

  assert.strictEqual(evt.defaultPrevented, true, 'link navigation must be suppressed in edit mode');
  assert.deepStrictEqual(selected, ['step_1']);
});

test('Link navigation: clicking a linked sequence participant selects without navigating', async () => {
  const code =
    'sequenceDiagram\n    participant Alice\n    participant Bob\n    Alice->>Bob: Hi\n    link Alice: Dash @ https://example.com\n';
  const proj = SequenceDiagramDriver.project(SequenceDiagramDriver.parse(code));
  const mountEl = await renderInto(code, 'test_link_sequence');

  const anchor = mountEl.querySelector('a[href*="example.com"]');
  assert.ok(anchor, 'expected mermaid to render a participant link');

  const selected: string[] = [];
  setupNodeInteractivity({
    mountEl: mountEl as any,
    dom: SequenceDiagramDriver.dom as any,
    displayNodes: proj.nodes as any,
    displaySubgraphs: proj.subgraphs as any,
    getLocalRect: nullRect as any,
    onSelectNode: (id: string) => {
      selected.push(id);
    },
    onSelectSubgraph: () => {},
    onStartEditingNode: () => {},
    onStartEditingSubgraph: () => {},
    onHoverNode: () => {},
  });

  const bound = mountEl.querySelector('[data-mermaid-node-id="Alice"]');
  assert.ok(bound, 'expected the linked participant to bind for selection');
  const evt = new dom.window.MouseEvent('click', { bubbles: true, cancelable: true });
  (bound as unknown as Element).dispatchEvent(evt);

  assert.strictEqual(evt.defaultPrevented, true, 'link navigation must be suppressed in edit mode');
  assert.deepStrictEqual(selected, ['Alice']);
});
