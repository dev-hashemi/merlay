import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { FlowchartDriver } from '../src/diagrams/flowchart/flowchartDriver';
import { matchNodeElementId } from '../src/canvas/interaction/matchNodeElement';
import { setupNodeInteractivity } from '../src/canvas/interaction/nodeInteractivity';
import { setupClusterInteractivity } from '../src/canvas/interaction/clusterInteractivity';

// DOM mock for mermaid.render
const dom = new JSDOM('<!DOCTYPE html><html><body><div id="c"></div></body></html>');
(global as any).window = dom.window;
(global as any).document = dom.window.document;
(global as any).SVGElement = dom.window.SVGElement;
(global as any).Element = dom.window.Element;
dom.window.SVGElement.prototype.getBBox = () => ({ x: 0, y: 0, width: 10, height: 10 });
(global as any).CSSStyleSheet = class CSSStyleSheet {
  cssRules = [];
  replaceSync() {}
  insertRule() {}
};

async function renderInto(code: string, renderId: string): Promise<HTMLElement> {
  const mermaid = (await import('mermaid')).default;
  mermaid.initialize({ startOnLoad: false });
  const { svg } = await mermaid.render(renderId, code);
  const mountEl = dom.window.document.createElement('div');
  mountEl.innerHTML = svg;
  return mountEl as unknown as HTMLElement;
}

test('Canvas Regression: Node prefix shadowing collision (step vs step-2)', async () => {
  const code = `flowchart TD
    step["Step Main"] --> step-2["Step Two"]
`;
  const ast = FlowchartDriver.parse(code);
  const proj = FlowchartDriver.project(ast);
  const mountEl = await renderInto(code, 'test_node_prefix_shadowing');

  const nodeElements = mountEl.querySelectorAll('.node');
  assert.equal(nodeElements.length, 2, 'Must render two node elements');

  const resolvedIds = Array.from(nodeElements).map((el) =>
    matchNodeElementId(
      el as SVGGraphicsElement,
      FlowchartDriver.dom as any,
      proj.nodes as any,
      FlowchartDriver.dom.nodeIdPrefixes!
    )
  );

  assert.ok(resolvedIds.includes('step'), 'Element for step must resolve to "step"');
  assert.ok(resolvedIds.includes('step-2'), 'Element for step-2 must resolve to "step-2" (not shadowed by "step")');

  // Verify that the element with id ending with step-2 does NOT match "step"
  const step2El = Array.from(nodeElements).find((el) => (el.getAttribute('id') || '').includes('step-2'));
  assert.ok(step2El);
  const step2Resolved = matchNodeElementId(
    step2El as SVGGraphicsElement,
    FlowchartDriver.dom as any,
    proj.nodes as any,
    FlowchartDriver.dom.nodeIdPrefixes!
  );
  assert.equal(step2Resolved, 'step-2', 'step-2 DOM element must resolve strictly to step-2');
});

test('Canvas Regression: Degraded empty subgraph with label/spaces binds correctly', async () => {
  const code = `flowchart TD
    subgraph "Empty Group"
    end
`;
  const ast = FlowchartDriver.parse(code);
  const proj = FlowchartDriver.project(ast);
  const mountEl = await renderInto(code, 'test_degraded_empty_subgraph');

  let selectedSubId: string | null = null;
  setupNodeInteractivity({
    mountEl: mountEl as any,
    dom: FlowchartDriver.dom as any,
    displayNodes: proj.nodes as any,
    displaySubgraphs: proj.subgraphs as any,
    getLocalRect: () => null,
    onSelectNode: () => {},
    onSelectSubgraph: (id) => {
      selectedSubId = id;
    },
    onStartEditingNode: () => {},
    onStartEditingSubgraph: () => {},
    onHoverNode: () => {},
  });

  const boundSubgraphs = mountEl.querySelectorAll('[data-mermaid-subgraph-id]');
  assert.equal(boundSubgraphs.length, 1, 'Empty subgraph degraded to node must be bound with data-mermaid-subgraph-id');
  assert.equal(
    boundSubgraphs[0].getAttribute('data-mermaid-subgraph-id'),
    'Empty Group',
    'Bound ID must be "Empty Group"'
  );

  // Simulate click on the empty subgraph element
  (boundSubgraphs[0] as HTMLElement).onclick?.({ stopPropagation: () => {} } as any);
  assert.equal(selectedSubId, 'Empty Group', 'Clicking the empty group element must trigger onSelectSubgraph');
});

test('Canvas Regression: Cluster prefix shadowing collision (sub vs sub-2)', async () => {
  const code = `flowchart TD
    subgraph sub ["First Group"]
        A["Step A"]
    end
    subgraph sub-2 ["Second Group"]
        B["Step B"]
    end
`;
  const ast = FlowchartDriver.parse(code);
  const proj = FlowchartDriver.project(ast);
  const mountEl = await renderInto(code, 'test_cluster_prefix_shadowing');

  setupNodeInteractivity({
    mountEl: mountEl as any,
    dom: FlowchartDriver.dom as any,
    displayNodes: proj.nodes as any,
    displaySubgraphs: proj.subgraphs as any,
    getLocalRect: () => null,
    onSelectNode: () => {},
    onSelectSubgraph: () => {},
    onStartEditingNode: () => {},
    onStartEditingSubgraph: () => {},
    onHoverNode: () => {},
  });

  const selections: string[] = [];
  setupClusterInteractivity({
    mountEl: mountEl as any,
    displaySubgraphs: proj.subgraphs as any,
    getLocalRect: () => null,
    onSelectSubgraph: (id) => {
      selections.push(id);
    },
    onStartEditingSubgraph: () => {},
  });

  const boundClusters = Array.from(mountEl.querySelectorAll('[data-mermaid-subgraph-id]'));
  assert.equal(boundClusters.length, 2, 'Both clusters must be bound');

  const boundIds = boundClusters.map((el) => el.getAttribute('data-mermaid-subgraph-id'));
  assert.ok(boundIds.includes('sub'), 'Cluster "sub" must be bound');
  assert.ok(boundIds.includes('sub-2'), 'Cluster "sub-2" must be bound without prefix collision');

  // Verify each cluster element resolves to its own distinct group
  const subCluster = boundClusters.find((el) => el.getAttribute('data-mermaid-subgraph-id') === 'sub');
  const sub2Cluster = boundClusters.find((el) => el.getAttribute('data-mermaid-subgraph-id') === 'sub-2');

  assert.ok(subCluster);
  assert.ok(sub2Cluster);
  assert.notEqual(subCluster, sub2Cluster);
});
