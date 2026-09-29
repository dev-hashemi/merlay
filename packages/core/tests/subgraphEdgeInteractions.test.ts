import test from 'node:test';
import assert from 'node:assert/strict';
import { FlowchartDriver } from '../src/diagrams/flowchart/flowchartDriver';
import { hasSubgraphDirectionConflict } from '../src/canvas/overlays/SubgraphOverlays';
import { MermaidSubgraphDef, MermaidEdgeDef } from '../src/diagrams/viewModel';

test('Flowchart: connectNodes supports Node to Subgraph, Subgraph to Node, and Subgraph to Subgraph', () => {
  const driver = FlowchartDriver;
  const code = [
    'flowchart TD',
    '    subgraph sub1 [Cluster One]',
    '        A["Step A"]',
    '    end',
    '    subgraph sub2 [Cluster Two]',
    '        B["Step B"]',
    '    end',
    '    C["Step C"]',
  ].join('\n');

  const ast = driver.parse(code);

  // canConnect validations
  assert.equal(driver.mutations.canConnect?.(ast, 'C', 'sub1'), true);
  assert.equal(driver.mutations.canConnect?.(ast, 'sub1', 'C'), true);
  assert.equal(driver.mutations.canConnect?.(ast, 'sub1', 'sub2'), true);
  assert.equal(driver.mutations.canConnect?.(ast, 'sub1', 'sub1'), false, 'Self-connection blocked');
  assert.equal(driver.mutations.canConnect?.(ast, 'nonexistent', 'sub1'), false);
  assert.equal(driver.mutations.canConnect?.(ast, 'sub1', 'nonexistent'), false);

  // 1. Connect node C to subgraph sub1
  driver.mutations.connect(ast, 'C', 'sub1');
  const edge1 = ast.edges.find((e) => e.from === 'C' && e.to === 'sub1');
  assert.ok(edge1, 'Edge C --> sub1 must exist in AST');

  // 2. Connect subgraph sub1 to node B
  driver.mutations.connect(ast, 'sub1', 'B');
  const edge2 = ast.edges.find((e) => e.from === 'sub1' && e.to === 'B');
  assert.ok(edge2, 'Edge sub1 --> B must exist in AST');

  // 3. Connect subgraph sub1 to subgraph sub2
  driver.mutations.connect(ast, 'sub1', 'sub2');
  const edge3 = ast.edges.find((e) => e.from === 'sub1' && e.to === 'sub2');
  assert.ok(edge3, 'Edge sub1 --> sub2 must exist in AST');

  // Serialize and verify
  const serialized = driver.serialize(ast);
  assert.match(serialized, /C\s*-->\s*sub1/);
  assert.match(serialized, /sub1\s*-->\s*B/);
  assert.match(serialized, /sub1\s*-->\s*sub2/);

  // Ensure serializer never emits fake standalone nodes like sub1["sub1"]
  assert.doesNotMatch(serialized, /^\s*sub1\["sub1"\]/m);
  assert.doesNotMatch(serialized, /^\s*sub2\["sub2"\]/m);

  // Round-trip parse: should not populate ast.nodes with subgraph IDs
  const reparsed = driver.parse(serialized);
  assert.equal(reparsed.nodes.has('sub1'), false, 'sub1 must not be in ast.nodes');
  assert.equal(reparsed.nodes.has('sub2'), false, 'sub2 must not be in ast.nodes');
  assert.equal(reparsed.subgraphs.has('sub1'), true, 'sub1 must be in ast.subgraphs');
  assert.equal(reparsed.subgraphs.has('sub2'), true, 'sub2 must be in ast.subgraphs');
});

test('Flowchart: parsing edge to subgraph written before subgraph definition prunes placeholder', () => {
  const driver = FlowchartDriver;
  const code = [
    'flowchart TD',
    '    C --> sub1',
    '    subgraph sub1 [Cluster One]',
    '        A',
    '    end',
  ].join('\n');

  const ast = driver.parse(code);
  assert.equal(ast.nodes.has('sub1'), false, 'sub1 must be pruned from ast.nodes');
  assert.equal(ast.subgraphs.has('sub1'), true, 'sub1 must be retained in ast.subgraphs');

  const serialized = driver.serialize(ast);
  assert.doesNotMatch(serialized, /^\s*sub1\["sub1"\]/m);
  assert.match(serialized, /C\s*-->\s*sub1/);
});

test('Flowchart: deleting subgraph prunes edges connected to that subgraph', () => {
  const driver = FlowchartDriver;
  const code = [
    'flowchart TD',
    '    subgraph sub1 [Cluster One]',
    '        A',
    '    end',
    '    C --> sub1',
    '    sub1 --> D',
  ].join('\n');

  const ast = driver.parse(code);
  assert.equal(ast.edges.length, 2);

  driver.mutations.deleteGroup(ast, 'sub1', false);
  assert.equal(ast.subgraphs.has('sub1'), false);
  assert.equal(ast.edges.some((e) => e.from === 'sub1' || e.to === 'sub1'), false, 'Edges to/from sub1 must be pruned');
});

test('hasSubgraphDirectionConflict: detects Mermaid Dagre flattening correctly', () => {
  const sub1: MermaidSubgraphDef = {
    type: 'subgraph',
    id: 'sub1',
    label: 'Sub One',
    nodeIds: ['A', 'B'],
    direction: 'TB',
  };

  const subgraphs = new Map<string, MermaidSubgraphDef>([['sub1', sub1]]);

  // 1. Conflict case: diagram is LR, sub1 has TB, and inner node B connects directly to external node C
  const edgesConflict: MermaidEdgeDef[] = [
    { type: 'edge', id: 'e1', from: 'A', to: 'B' },
    { type: 'edge', id: 'e2', from: 'B', to: 'C' },
  ];
  assert.equal(
    hasSubgraphDirectionConflict(sub1, 'LR', subgraphs, edgesConflict),
    true,
    'Inner node B connected to outer node C causes Dagre layout conflict'
  );

  // 2. Fixed/Correct case: diagram is LR, sub1 has TB, and connection is made from the group boundary (sub1 --> C)
  const edgesNoConflict: MermaidEdgeDef[] = [
    { type: 'edge', id: 'e1', from: 'A', to: 'B' },
    { type: 'edge', id: 'e2', from: 'sub1', to: 'C' },
  ];
  assert.equal(
    hasSubgraphDirectionConflict(sub1, 'LR', subgraphs, edgesNoConflict),
    false,
    'Group boundary connection sub1 --> C preserves independent TB layout'
  );

  // 3. Same orientation: diagram is TD, sub1 has TB (both vertical), so no conflict even with cross-boundary edge
  assert.equal(
    hasSubgraphDirectionConflict(sub1, 'TD', subgraphs, edgesConflict),
    false,
    'Matching diagram orientation (vertical) has no layout contradiction'
  );

  // 4. No local override: subgraph has no direction set
  const subNoOverride: MermaidSubgraphDef = {
    type: 'subgraph',
    id: 'sub2',
    label: 'Sub Two',
    nodeIds: ['A', 'B'],
  };
  const subgraphs2 = new Map<string, MermaidSubgraphDef>([['sub2', subNoOverride]]);
  assert.equal(
    hasSubgraphDirectionConflict(subNoOverride, 'LR', subgraphs2, edgesConflict),
    false,
    'No conflict when subgraph has no direction override'
  );
});
