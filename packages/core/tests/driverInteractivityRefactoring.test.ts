import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { SequenceDiagramDriver } from '../src/diagrams/sequence/sequenceDriver';
import { setupSvgInteractivity } from '../src/canvas/interaction/setupSvgInteractivity';
import { setupEdgeInteractivity } from '../src/canvas/interaction/edgeInteractivity';
import { setupClusterInteractivity } from '../src/canvas/interaction/clusterInteractivity';
import { MermaidEdgeDef, MermaidSubgraphDef } from '../src/diagrams/viewModel';
import { SvgDomAdapter } from '../src/diagrams/types';

// DOM harness
const domWindow = new JSDOM('<!DOCTYPE html><html><body><div id="c"></div></body></html>');
(global as any).window = domWindow.window;
(global as any).document = domWindow.window.document;
(global as any).SVGElement = domWindow.window.SVGElement;
(global as any).Element = domWindow.window.Element;
(global as any).MouseEvent = domWindow.window.MouseEvent;
(domWindow.window.Element.prototype as any).setCssStyles = function (styles: Record<string, string>) {
  for (const k of Object.keys(styles || {})) {
    try {
      (this as any).style[k] = (styles as any)[k];
    } catch {
      /* ignore */
    }
  }
};

const nullRect = () => null;

test('Driver contract: sequence driver provides canvasHint for touch and desktop', () => {
  assert.ok(SequenceDiagramDriver.canvasHint, 'SequenceDiagramDriver should provide canvasHint');
  assert.ok(typeof SequenceDiagramDriver.canvasHint.desktop === 'string');
  assert.ok(typeof SequenceDiagramDriver.canvasHint.touch === 'string');
  assert.ok(SequenceDiagramDriver.canvasHint.desktop.length > 0);
  assert.ok(SequenceDiagramDriver.canvasHint.touch.length > 0);
});

test('NativeMermaidView: no hardcoded driver.type branches in JSX view', () => {
  const filePath = path.resolve(__dirname, '../src/canvas/NativeMermaidView.tsx');
  const content = fs.readFileSync(filePath, 'utf-8');
  assert.ok(
    !content.includes("driver.type === 'sequenceDiagram'"),
    'NativeMermaidView should not branch on driver.type'
  );
});

test('Edge Interactivity: respects custom dom.edgeSelector', () => {
  const mountEl = domWindow.window.document.createElement('div');
  const svg = domWindow.window.document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  mountEl.appendChild(svg);

  // Create an edge with a custom class not in the default selector (e.g. custom-diagram link)
  const customPath = domWindow.window.document.createElementNS('http://www.w3.org/2000/svg', 'path');
  customPath.setAttribute('class', 'custom-diagram-edge');
  customPath.setAttribute('d', 'M 0 0 L 100 100');
  customPath.setAttribute('id', 'edge_1');
  svg.appendChild(customPath);

  const displayEdges: MermaidEdgeDef[] = [
    {
      type: 'edge',
      id: 'edge_1',
      from: 'A',
      to: 'B',
      arrowType: 'arrow',
    },
  ];

  const customDom: SvgDomAdapter = {
    nodeIdPrefixes: ['custom-'],
    edgeSelector: 'path.custom-diagram-edge',
  };

  let selectedEdgeId: string | null = null;
  setupEdgeInteractivity({
    mountEl: mountEl as unknown as HTMLElement,
    dom: customDom,
    displayEdges,
    onSelectEdge: (edge) => {
      selectedEdgeId = edge.id;
    },
    onStartEditingEdge: () => {},
  });

  // The custom edge should now have data-mermaid-edge-id
  assert.strictEqual(customPath.getAttribute('data-mermaid-edge-id'), 'edge_1');

  // Trigger click on custom edge
  customPath.dispatchEvent(new domWindow.window.MouseEvent('click', { bubbles: true }));
  assert.strictEqual(selectedEdgeId, 'edge_1');
});

test('Cluster Interactivity: respects custom dom.clusterSelector and dom.clusterIdPrefixes', () => {
  const mountEl = domWindow.window.document.createElement('div');
  const svg = domWindow.window.document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  mountEl.appendChild(svg);

  // Create a cluster with custom selector & prefix (e.g. classDiagram package)
  const pkgGroup = domWindow.window.document.createElementNS('http://www.w3.org/2000/svg', 'g');
  pkgGroup.setAttribute('class', 'package-group');
  pkgGroup.setAttribute('id', 'pkg-sub_1');

  const pkgRect = domWindow.window.document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  pkgGroup.appendChild(pkgRect);
  svg.appendChild(pkgGroup);

  const displaySubgraphs = new Map<string, MermaidSubgraphDef>();
  displaySubgraphs.set('sub_1', {
    type: 'subgraph',
    id: 'sub_1',
    label: 'Test Package',
    nodeIds: [],
    subgraphIds: [],
  });

  const customDom: SvgDomAdapter = {
    nodeIdPrefixes: ['classId-'],
    clusterIdPrefixes: ['pkg-'],
    clusterSelector: '.package-group',
  };

  let selectedSubId: string | null = null;
  setupClusterInteractivity({
    mountEl: mountEl as unknown as HTMLElement,
    dom: customDom,
    displaySubgraphs,
    getLocalRect: nullRect,
    onSelectSubgraph: (subId) => {
      selectedSubId = subId;
    },
    onStartEditingSubgraph: () => {},
  });

  // The cluster group should have data-mermaid-node-id
  assert.strictEqual(pkgGroup.getAttribute('data-mermaid-node-id'), 'sub_1');

  // Trigger click
  pkgGroup.dispatchEvent(new domWindow.window.MouseEvent('click', { bubbles: true }));
  assert.strictEqual(selectedSubId, 'sub_1');
});
