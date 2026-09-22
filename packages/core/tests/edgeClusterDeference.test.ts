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

// ── Helpers for pointer-decision tests ───────────────────────────────────

const CROSSING_CODE = `flowchart LR
    subgraph grp ["My Group"]
        a["A"]
    end
    b["B"]
    c["C"]
    b --> c`;

function stubRect(el: Element, rect: { left: number; top: number; right: number; bottom: number }): void {
  (el as any).getBoundingClientRect = () => ({
    x: rect.left, y: rect.top,
    width: rect.right - rect.left, height: rect.bottom - rect.top,
    top: rect.top, left: rect.left, right: rect.right, bottom: rect.bottom,
    toJSON: () => {},
  });
}

/**
 * Stub an edge path as a horizontal screen-space segment y=100, x=0..200
 * so getDistanceToSvgPath() returns true pixel distances in JSDOM.
 */
function stubEdgeSegment(pathEl: Element): void {
  stubRect(pathEl, { left: 0, top: 90, right: 200, bottom: 110 });
  (pathEl as any).getScreenCTM = () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
  (pathEl as any).getTotalLength = () => 200;
  (pathEl as any).getPointAtLength = (len: number) => ({ x: len, y: 100 });
}

async function setupCrossingScene(): Promise<{
  mountEl: HTMLElement;
  hitArea: Element;
  edgeId: string;
  clusterId: string;
  select: { edge: string | null; sub: string | null };
}> {
  const mountEl = await renderInto(CROSSING_CODE, 'test_edge_over_group');
  const ast = FlowchartDriver.parse(CROSSING_CODE);
  const proj = FlowchartDriver.project(ast);

  const select = { edge: null as string | null, sub: null as string | null };
  setupEdgeInteractivity({
    mountEl: mountEl as any,
    displayEdges: proj.edges as any,
    displaySubgraphs: proj.subgraphs as any,
    onSelectEdge: (e) => { select.edge = e.id; },
    onStartEditingEdge: () => {},
  });
  setupClusterInteractivity({
    mountEl: mountEl as any,
    displaySubgraphs: proj.subgraphs as any,
    getLocalRect: nullRect as any,
    onSelectSubgraph: (id) => { select.sub = id; },
    onStartEditingSubgraph: () => {},
  });

  const hitArea = mountEl.querySelector('.mermaid-edge-hit-area');
  assert.ok(hitArea, 'a crossing edge hit-area must exist');
  const edgeId = hitArea.getAttribute('data-mermaid-edge-id')!;
  assert.ok(edgeId, 'hit-area must carry an edge id');

  const clusterEl = mountEl.querySelector('[data-mermaid-subgraph-id]');
  assert.ok(clusterEl, 'a bound cluster must exist');
  const clusterId = clusterEl.getAttribute('data-mermaid-subgraph-id')!;

  // The test is only meaningful when the edge merely passes over the
  // cluster instead of being internal to it.
  const internal = (proj.subgraphs.get(clusterId) as any)?.nodeIds ?? [];
  const edge = (proj.edges as any[]).find((e: any) => e.id === edgeId);
  assert.ok(
    !(internal.includes(edge.from) && internal.includes(edge.to)),
    `edge ${edgeId} must NOT be internal to cluster ${clusterId}`
  );

  // The cluster frame covers the click point; the edge stroke runs through it.
  stubRect(clusterEl.querySelector(':scope > rect')!, { left: 0, top: 0, right: 400, bottom: 400 });
  const pathEl = mountEl.querySelector(
    `[data-mermaid-edge-id="${edgeId}"]:not(.mermaid-edge-hit-area)`
  )!;
  assert.ok(pathEl, 'the real edge path must exist');
  stubEdgeSegment(pathEl);

  return { mountEl, hitArea, edgeId, clusterId, select };
}

test('Click directly on an edge stroke over a foreign cluster selects the edge', async () => {
  const { hitArea, edgeId, select } = await setupCrossingScene();

  // (100,100) is exactly on the stubbed edge centerline, inside the cluster.
  hitArea.dispatchEvent(
    new dom.window.MouseEvent('click', { bubbles: true, clientX: 100, clientY: 100 })
  );
  assert.equal(select.edge, edgeId, 'on-stroke click over a group must select the edge');
  assert.equal(select.sub, null, 'on-stroke click must NOT select the group');
});

test('Click in the edge halo margin over a foreign cluster still selects the group', async () => {
  const { hitArea, clusterId, select } = await setupCrossingScene();

  // (100,106) is 6px off the centerline: inside the 14px hit-area halo but
  // clearly aimed at the group background, so deference must still apply.
  hitArea.dispatchEvent(
    new dom.window.MouseEvent('click', { bubbles: true, clientX: 100, clientY: 106 })
  );
  assert.equal(select.edge, null, 'halo-margin click must NOT select the edge');
  assert.equal(select.sub, clusterId, 'halo-margin click over a group must select the group');
});
