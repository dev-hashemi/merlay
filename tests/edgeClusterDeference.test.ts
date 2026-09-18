/**
 * Regression test: edge hit-areas that cross through a subgraph cluster must
 * defer pointer events to the cluster, while edges fully internal to a cluster
 * remain clickable.
 *
 * Bug: In `flowchart LR` with long edges curving over a subgraph, the 14 px
 * edge hit-area (rendered above `.clusters` in SVG document order) intercepted
 * clicks/hover intended for the cluster, making the subgraph unselectable.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { FlowchartDriver } from '../src/diagrams/flowchart/flowchartDriver';
import { setupEdgeInteractivity } from '../src/canvas/interaction/edgeInteractivity';
import { setupClusterInteractivity } from '../src/canvas/interaction/clusterInteractivity';

// ── JSDOM shims ────────────────────────────────────────────────────────
const dom = new JSDOM('<!DOCTYPE html><html><body><div id="c"></div></body></html>');
(global as any).window = dom.window;
(global as any).document = dom.window.document;
(global as any).SVGElement = dom.window.SVGElement;
(global as any).Element = dom.window.Element;
(global as any).MouseEvent = dom.window.MouseEvent;
dom.window.SVGElement.prototype.getBBox = function () {
  const text = this.textContent || '';
  const w = Math.max(text.length * 8 + 20, 50);
  return { x: 0, y: 0, width: w, height: 40 };
};
(global as any).CSSStyleSheet = class CSSStyleSheet {
  cssRules = [];
  replaceSync() {}
  insertRule() {}
};
(global as any).createSvg = (tag: string) =>
  dom.window.document.createElementNS('http://www.w3.org/2000/svg', tag);
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

// ── Tests ──────────────────────────────────────────────────────────────

test('Edge hit-area defers to cluster for crossing edges', async () => {
  const code = `flowchart LR
    subgraph sub_1 ["Group one"]
        step_2[/"1"\\]
    end

    subgraph sub_2 ["New Group"]
        step_3((("cant select this group!")))
    end

    step_1["2"]

    step_2 -->|long edge 1| step_1
    step_1 -->|Long edge 2| step_2
    step_2 --> step_3
    step_2 --> step_3
    step_3 --> step_1

    click step_1 "https://google.com"`;

  const mountEl = await renderInto(code, 'test_edge_cluster_defer');
  const ast = FlowchartDriver.parse(code);
  const proj = FlowchartDriver.project(ast);

  let selectedSubId: string | null = null;
  let selectedEdgeId: string | null = null;

  // Wire up edge interactivity WITH subgraphs so deference logic is active
  setupEdgeInteractivity({
    mountEl: mountEl as any,
    displayEdges: proj.edges as any,
    displaySubgraphs: proj.subgraphs as any,
    onSelectEdge: (e) => { selectedEdgeId = e.id; },
    onStartEditingEdge: () => {},
  });

  // Wire up cluster interactivity
  setupClusterInteractivity({
    mountEl: mountEl as any,
    displaySubgraphs: proj.subgraphs as any,
    getLocalRect: nullRect as any,
    onSelectSubgraph: (id) => { selectedSubId = id; },
    onStartEditingSubgraph: () => {},
  });

  // Verify sub_2 was bound
  const sub2El = mountEl.querySelector('[data-mermaid-subgraph-id="sub_2"]');
  assert.ok(sub2El, 'sub_2 cluster must be bound');

  // Verify that edge step_2→step_1 is NOT internal to sub_2
  // (step_2 is in sub_1, step_1 is outside both groups)
  const sub2Def = proj.subgraphs.get('sub_2')!;
  assert.ok(!sub2Def.nodeIds.includes('step_2'), 'step_2 should NOT be in sub_2');
  assert.ok(!sub2Def.nodeIds.includes('step_1'), 'step_1 should NOT be in sub_2');

  // Verify that clicking on the cluster sub_2 rect triggers subgraph selection
  selectedSubId = null;
  const rectEl = sub2El!.querySelector(':scope > rect')!;
  rectEl.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  assert.equal(selectedSubId, 'sub_2', 'Clicking cluster rect must select sub_2');
});

test('Edge hit-area does NOT defer for edges internal to a cluster', async () => {
  const code = `flowchart LR
    subgraph grp ["My Group"]
        a["A"]
        b["B"]
    end
    a --> b
    c["C"] --> a`;

  const mountEl = await renderInto(code, 'test_internal_edge');
  const ast = FlowchartDriver.parse(code);
  const proj = FlowchartDriver.project(ast);

  let selectedEdgeId: string | null = null;

  setupEdgeInteractivity({
    mountEl: mountEl as any,
    displayEdges: proj.edges as any,
    displaySubgraphs: proj.subgraphs as any,
    onSelectEdge: (e) => { selectedEdgeId = e.id; },
    onStartEditingEdge: () => {},
  });

  setupClusterInteractivity({
    mountEl: mountEl as any,
    displaySubgraphs: proj.subgraphs as any,
    getLocalRect: nullRect as any,
    onSelectSubgraph: () => {},
    onStartEditingSubgraph: () => {},
  });

  // Verify a→b is internal to grp (both a and b are in grp)
  const grpDef = proj.subgraphs.get('grp')!;
  assert.ok(grpDef.nodeIds.includes('a'), 'a should be in grp');
  assert.ok(grpDef.nodeIds.includes('b'), 'b should be in grp');

  // c→a: c is NOT in grp, so this edge is NOT internal → should defer
  assert.ok(!grpDef.nodeIds.includes('c'), 'c should NOT be in grp');
});

test('Cluster label foreignObject children get click handlers', async () => {
  const code = `flowchart LR
    subgraph grp ["My Group"]
        a["Node"]
    end`;

  const mountEl = await renderInto(code, 'test_cluster_label');
  const ast = FlowchartDriver.parse(code);
  const proj = FlowchartDriver.project(ast);

  let selectedSubId: string | null = null;

  setupClusterInteractivity({
    mountEl: mountEl as any,
    displaySubgraphs: proj.subgraphs as any,
    getLocalRect: nullRect as any,
    onSelectSubgraph: (id) => { selectedSubId = id; },
    onStartEditingSubgraph: () => {},
  });

  // Find the cluster's foreignObject or nodeLabel child
  const clusterEl = mountEl.querySelector('[data-mermaid-subgraph-id="grp"]')!;
  assert.ok(clusterEl, 'grp cluster must be bound');

  const nodeLabel = clusterEl.querySelector('.nodeLabel');
  if (nodeLabel) {
    // The nodeLabel should have a click handler set by bindCluster
    assert.equal(
      (nodeLabel as any).style.cursor, 'pointer',
      'cluster label .nodeLabel must have cursor: pointer'
    );
  }

  const foreignObj = clusterEl.querySelector('foreignObject');
  if (foreignObj) {
    assert.equal(
      (foreignObj as any).style.cursor, 'pointer',
      'cluster label foreignObject must have cursor: pointer'
    );
  }
});
