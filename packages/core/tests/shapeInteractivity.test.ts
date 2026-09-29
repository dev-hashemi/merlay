/**
 * Shape interactivity regressions (real mermaid renders in jsdom):
 * 1. Icon nodes render as g.icon-shape (not g.node) yet must be clickable
 *    through the driver's DOM adapter.
 * 2. Bucket/person/console/image must render and stay clickable end to end.
 * 3. setNodeShapeParam round-trips (image URL set/clear keeps the shape).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { FlowchartDriver } from '../src/diagrams/flowchart/flowchartDriver';
import {
  getNodeShapeParam,
  setNodeShapeParam,
} from '../src/diagrams/flowchart/mutations';
import { parseMermaidFlowchart } from '../src/diagrams/flowchart/parser';
import { serializeMermaidFlowchart } from '../src/diagrams/flowchart/serializer';
import { setupNodeInteractivity } from '../src/canvas/interaction/nodeInteractivity';

const dom = new JSDOM('<!DOCTYPE html><html><body><div id="c"></div></body></html>');
(global as any).window = dom.window;
(global as any).document = dom.window.document;
(global as any).SVGElement = dom.window.SVGElement;
(global as any).Element = dom.window.Element;
(global as any).DOMParser = dom.window.DOMParser;
(global as any).XMLSerializer = dom.window.XMLSerializer;
dom.window.SVGElement.prototype.getBBox = () => ({ x: 0, y: 0, width: 10, height: 10 });
(global as any).CSSStyleSheet = class CSSStyleSheet {
  cssRules = [];
  replaceSync() {}
  insertRule() {}
};
(dom.window.Element.prototype as any).setCssStyles = function (styles: Record<string, string>) {
  for (const k of Object.keys(styles || {})) {
    try { (this as any).style[k] = (styles as any)[k]; } catch { /* ignore */ }
  }
};
// jsdom lacks the Image constructor (mermaid image-shape preloads)
(global as any).Image = class {
  onload: (() => void) | null = null;
  width = 60; height = 60;
  naturalWidth = 60; naturalHeight = 60;
  set src(_v: string) { setTimeout(() => this.onload?.(), 0); }
  decode() { return Promise.resolve(); }
};

const nullRect = () => null;

async function renderAndClick(code: string, renderId: string, nodeId: string): Promise<string> {
  const mermaid = (await import('mermaid')).default;
  mermaid.initialize({ startOnLoad: false });
  const { svg } = await mermaid.render(renderId, code);
  const mountEl = dom.window.document.createElement('div');
  mountEl.innerHTML = svg;
  const ast = parseMermaidFlowchart(code);
  const proj = FlowchartDriver.project(ast);
  const selected: string[] = [];
  setupNodeInteractivity({
    mountEl: mountEl as any,
    dom: FlowchartDriver.dom as any,
    displayNodes: proj.nodes as any,
    displaySubgraphs: proj.subgraphs as any,
    getLocalRect: nullRect as any,
    onSelectNode: (nid) => { selected.push(nid); },
    onSelectSubgraph: () => {},
    onStartEditingNode: () => {},
    onStartEditingSubgraph: () => {},
    onHoverNode: () => {},
  });
  const nodeEl = mountEl.querySelector('[data-mermaid-node-id]');
  assert.ok(nodeEl, `a node element must match for ${renderId}`);
  (nodeEl as any).onclick?.({ preventDefault() {}, stopPropagation() {}, shiftKey: false } as any);
  assert.ok(selected.includes(nodeId), `${renderId}: clicking must select ${nodeId}`);
  return (nodeEl as Element).tagName.toLowerCase();
}

function codeFor(kind: string): { code: string; nodeId: string } {
  const ast = FlowchartDriver.createEmpty();
  const nodeId = FlowchartDriver.mutations.addNode(ast, 'Probe');
  FlowchartDriver.mutations.updateNodeKind(ast, nodeId, kind);
  return { code: FlowchartDriver.serialize(ast), nodeId };
}

test('Icon shape: renders as g.icon-shape and is clickable via DOM adapter', async () => {
  const { code, nodeId } = codeFor('icon');
  const tag = await renderAndClick(code, 'shape_icon_click', nodeId);
  assert.equal(tag, 'g');
});

test('Image shape with URL: renders and is clickable', async () => {
  const ast = FlowchartDriver.createEmpty();
  const nodeId = FlowchartDriver.mutations.addNode(ast, 'Pic');
  FlowchartDriver.mutations.updateNodeKind(ast, nodeId, 'image');
  assert.ok(setNodeShapeParam(ast, nodeId, 'img', 'https://example.com/a.png'));
  const code = FlowchartDriver.serialize(ast);
  assert.ok(code.includes('https://example.com/a.png'));
  await renderAndClick(code, 'shape_image_click', nodeId);
});

test('Bucket/person/console: render and stay clickable end to end', async () => {
  for (const kind of ['bucket', 'person', 'console']) {
    const { code, nodeId } = codeFor(kind);
    await renderAndClick(code, `shape_${kind.replace(/[^a-z]/g, '')}_click`, nodeId);
  }
});

test('setNodeShapeParam: set/clear round-trips without losing the shape', () => {
  const ast = parseMermaidFlowchart('flowchart TD\n    A["Pic"]\n');
  FlowchartDriver.mutations.updateNodeKind(ast, 'A', 'image');
  assert.ok(setNodeShapeParam(ast, 'A', 'img', 'https://example.com/a.png'));
  assert.equal(getNodeShapeParam(ast, 'A', 'img'), 'https://example.com/a.png');
  let out = serializeMermaidFlowchart(ast);
  let reparsed = parseMermaidFlowchart(out);
  assert.equal(reparsed.nodes.get('A')?.shape, 'image');
  assert.equal(reparsed.nodes.get('A')?.shapeParams?.img, 'https://example.com/a.png');

  // Clearing keeps the image shape (serializer still emits a discriminator)
  assert.ok(setNodeShapeParam(ast, 'A', 'img', null));
  assert.equal(getNodeShapeParam(ast, 'A', 'img'), undefined);
  out = serializeMermaidFlowchart(ast);
  reparsed = parseMermaidFlowchart(out);
  assert.equal(reparsed.nodes.get('A')?.shape, 'image');

  // Unknown nodes/keys are safe no-ops
  assert.equal(getNodeShapeParam(ast, 'Nope', 'img'), undefined);
  assert.equal(setNodeShapeParam(ast, 'Nope', 'img', 'x'), false);
});
