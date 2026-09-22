import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchSvgEdgeToAst } from '../src/utils/edgeMatching';
import { MermaidEdgeDef } from '../src/diagrams/viewModel';

const sampleEdges: MermaidEdgeDef[] = [
  {
    type: 'edge',
    id: 'e_User_Login_1',
    from: 'User',
    to: 'Login',
    arrowType: 'arrow',
    label: '1. Enter Credentials',
  },
  {
    type: 'edge',
    id: 'e_Login_AuthService_2',
    from: 'Login',
    to: 'AuthService',
    arrowType: 'thick',
    label: '2. Verify Hash',
  },
  {
    type: 'edge',
    id: 'e_step-dash-1_step-dash-2_3',
    from: 'step-dash-1',
    to: 'step-dash-2',
    arrowType: 'dotted',
    label: 'Async Notification',
  },
  {
    type: 'edge',
    id: 'e_A_B_captionless',
    from: 'Alpha',
    to: 'Beta',
    arrowType: 'arrow',
  },
];

test('Edge Matching: Mermaid v10 underscore ID format L_From_To_Index', () => {
  const matched = matchSvgEdgeToAst({ id: 'L_User_Login_0' }, sampleEdges);
  assert.ok(matched);
  assert.equal(matched.from, 'User');
  assert.equal(matched.to, 'Login');
});

test('Edge Matching: Mermaid v9 hyphenated ID format L-From-To-Index', () => {
  const matched = matchSvgEdgeToAst({ id: 'L-Login-AuthService-0' }, sampleEdges);
  assert.ok(matched);
  assert.equal(matched.from, 'Login');
  assert.equal(matched.to, 'AuthService');
  assert.equal(matched.arrowType, 'thick');
});

test('Edge Matching: Node IDs containing hyphens and underscores', () => {
  // Mermaid transforms hyphens to underscores or keeps hyphens in SVG IDs
  const matched1 = matchSvgEdgeToAst({ id: 'L_step_dash_1_step_dash_2_0' }, sampleEdges);
  assert.ok(matched1);
  assert.equal(matched1.from, 'step-dash-1');
  assert.equal(matched1.to, 'step-dash-2');

  const matched2 = matchSvgEdgeToAst({ id: 'L-step-dash-1-step-dash-2-0' }, sampleEdges);
  assert.ok(matched2);
  assert.equal(matched2.from, 'step-dash-1');
  assert.equal(matched2.to, 'step-dash-2');
});

test('Edge Matching: Dagre-d3 class annotations LS_From and LE_To', () => {
  const matched = matchSvgEdgeToAst(
    { className: 'edgePath flowchart-link LS_User LE_Login' },
    sampleEdges
  );
  assert.ok(matched);
  assert.equal(matched.from, 'User');
  assert.equal(matched.to, 'Login');
});

test('Edge Matching: Direct textContent matching on edge labels', () => {
  const matched = matchSvgEdgeToAst(
    { id: 'random-text-container-42', textContent: '  1. Enter Credentials  ' },
    sampleEdges
  );
  assert.ok(matched);
  assert.equal(matched.id, 'e_User_Login_1');
  assert.equal(matched.label, '1. Enter Credentials');
});

test('Edge Matching: Captionless edges matched via SVG path ID', () => {
  const matched = matchSvgEdgeToAst({ id: 'L_Alpha_Beta_0' }, sampleEdges);
  assert.ok(matched);
  assert.equal(matched.from, 'Alpha');
  assert.equal(matched.to, 'Beta');
  assert.equal(matched.label, undefined);
});

test('Edge Matching: Sequential fallback index when SVG element has no matching attributes', () => {
  // Completely generic SVG path element
  const matched0 = matchSvgEdgeToAst({ id: '', className: 'path' }, sampleEdges, 0);
  assert.ok(matched0);
  assert.equal(matched0.from, 'User');

  const matched2 = matchSvgEdgeToAst({ id: 'path-99' }, sampleEdges, 2);
  assert.ok(matched2);
  assert.equal(matched2.from, 'step-dash-1');
  assert.equal(matched2.to, 'step-dash-2');
});

test('Edge Matching: Returns null for non-edge elements and out-of-bounds fallback', () => {
  const nonEdge = matchSvgEdgeToAst({ id: 'arrowheadPath', className: 'arrowMarker' }, sampleEdges);
  assert.equal(nonEdge, null);

  const outOfBounds = matchSvgEdgeToAst({ id: 'unknown-id' }, sampleEdges, 999);
  assert.equal(outOfBounds, null);

  const emptyList = matchSvgEdgeToAst({ id: 'L_User_Login_0' }, [], 0);
  assert.equal(emptyList, null);
});

test('Edge Matching: User scenario - Short arrow (B -> node_3954) vs Long arrow (A -> C)', () => {
  const userEdges: MermaidEdgeDef[] = [
    { type: 'edge', id: 'e0', from: 'A', to: 'B', arrowType: 'arrow' },
    { type: 'edge', id: 'e1', from: 'B', to: 'node_3954', arrowType: 'arrow' },
    { type: 'edge', id: 'e2', from: 'A', to: 'node_3807', arrowType: 'arrow' },
    { type: 'edge', id: 'e3', from: 'A', to: 'node_0246', arrowType: 'arrow' },
    { type: 'edge', id: 'e4', from: 'A', to: 'node_1537', arrowType: 'arrow' },
    { type: 'edge', id: 'e5', from: 'node_1003', to: 'node_9721', arrowType: 'arrow' },
    { type: 'edge', id: 'e6', from: 'node_3954', to: 'node_2319', arrowType: 'arrow' },
    { type: 'edge', id: 'e7', from: 'node_2319', to: 'C', arrowType: 'arrow' },
    { type: 'edge', id: 'e8', from: 'node_1537', to: 'node_1003', arrowType: 'arrow' },
    { type: 'edge', id: 'e9', from: 'A', to: 'C', arrowType: 'arrow' },
  ];

  // 1. Matching B -> node_3954 via Dagre-d3 classes on parent group
  const matchedShort1 = matchSvgEdgeToAst(
    { className: 'edgePath flowchart-link LS_B LE_node_3954' },
    userEdges
  );
  assert.ok(matchedShort1);
  assert.equal(matchedShort1.from, 'B');
  assert.equal(matchedShort1.to, 'node_3954');
  assert.equal(matchedShort1.id, 'e1');

  // 2. Matching B -> node_3954 via hyphenated ID L-B-node_3954-0
  const matchedShort2 = matchSvgEdgeToAst(
    { id: 'L-B-node_3954-0', className: 'path' },
    userEdges
  );
  assert.ok(matchedShort2);
  assert.equal(matchedShort2.from, 'B');
  assert.equal(matchedShort2.to, 'node_3954');

  // 3. Matching A -> C via Dagre-d3 classes
  const matchedLong1 = matchSvgEdgeToAst(
    { className: 'edgePath flowchart-link LS_A LE_C' },
    userEdges
  );
  assert.ok(matchedLong1);
  assert.equal(matchedLong1.from, 'A');
  assert.equal(matchedLong1.to, 'C');
  assert.equal(matchedLong1.id, 'e9');

  // 4. Ensure single-letter node 'A' does not incorrectly match 'node_0246' or others
  const matchedOtherA = matchSvgEdgeToAst(
    { className: 'edgePath flowchart-link LS_A LE_node_0246' },
    userEdges
  );
  assert.ok(matchedOtherA);
  assert.equal(matchedOtherA.from, 'A');
  assert.equal(matchedOtherA.to, 'node_0246');
  assert.equal(matchedOtherA.id, 'e3');

  // 5. Simulating findEdgeForElement combining parent group + child path
  // When child path has class="path" and parent group has id="L-B-node_3954-0" and class="edgePath LS-B LE-node_3954"
  const simulatedMetadata = {
    id: 'L-B-node_3954-0',
    className: 'path edgePath flowchart-link LS-B LE-node_3954',
    textContent: '',
  };
  const matchedCombined = matchSvgEdgeToAst(simulatedMetadata, userEdges, 9); // fallback index 9 is A -> C
  assert.ok(matchedCombined);
  // Must NOT fall back to fallbackIdx 9 (which is A -> C); must match B -> node_3954!
  assert.equal(matchedCombined.from, 'B');
  assert.equal(matchedCombined.to, 'node_3954');
  assert.equal(matchedCombined.id, 'e1');
});

test('Edge Geometry: getDistanceToSvgPath calculates proximity correctly', async () => {
  const { getDistanceToSvgPath } = await import('../src/utils/edgeGeometry');

  // Test 1: Invalid or non-SVG element returns Infinity
  assert.equal(getDistanceToSvgPath(null as any, 100, 100), Infinity);

  // Test 2: Bounding box far away (> 25px) returns Infinity
  const mockFarEl: any = {
    getBoundingClientRect: () => ({
      left: 10,
      right: 50,
      top: 10,
      bottom: 50,
      width: 40,
      height: 40,
    }),
  };
  assert.equal(getDistanceToSvgPath(mockFarEl, 300, 300), Infinity);

  // Test 3: Path without SVG CTM/length falls back to bbox distance
  const mockBboxOnlyEl: any = {
    getBoundingClientRect: () => ({
      left: 100,
      right: 200,
      top: 100,
      bottom: 200,
      width: 100,
      height: 100,
    }),
  };
  // Point at (90, 100) -> 10px from left edge
  const distBbox = getDistanceToSvgPath(mockBboxOnlyEl, 90, 100);
  assert.equal(distBbox, 10);

  // Test 4: Path with SVG methods samples curve points
  // Straight horizontal line from (100, 100) to (200, 100)
  const mockPathEl: any = {
    getBoundingClientRect: () => ({
      left: 100,
      right: 200,
      top: 98,
      bottom: 102,
      width: 100,
      height: 4,
    }),
    getScreenCTM: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
    getTotalLength: () => 100,
    getPointAtLength: (len: number) => ({ x: 100 + len, y: 100 }),
  };

  // Cursor at (150, 105) is 5px below the middle of the path
  const dist = getDistanceToSvgPath(mockPathEl, 150, 105);
  assert.ok(Math.abs(dist - 5) < 0.5, `Expected dist ~5, got ${dist}`);

  // Test 5: Parallel paths proximity resolution - cursor closer to short path
  // Short path from (120, 100) to (180, 100)
  const shortPathEl: any = {
    getBoundingClientRect: () => ({
      left: 120,
      right: 180,
      top: 98,
      bottom: 102,
      width: 60,
      height: 4,
    }),
    getScreenCTM: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
    getTotalLength: () => 60,
    getPointAtLength: (len: number) => ({ x: 120 + len, y: 100 }),
  };

  // Long path from (50, 115) to (350, 115) running parallel 15px below
  const longPathEl: any = {
    getBoundingClientRect: () => ({
      left: 50,
      right: 350,
      top: 113,
      bottom: 117,
      width: 300,
      height: 4,
    }),
    getScreenCTM: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
    getTotalLength: () => 300,
    getPointAtLength: (len: number) => ({ x: 50 + len, y: 115 }),
  };

  // Mouse is at (150, 102) -> 2px from short path, 13px from long path
  const distToShort = getDistanceToSvgPath(shortPathEl, 150, 102);
  const distToLong = getDistanceToSvgPath(longPathEl, 150, 102);

  assert.ok(distToShort < distToLong, `Short (${distToShort}) should be closer than long (${distToLong})`);
  assert.ok(Math.abs(distToShort - 2) < 0.5);
  assert.ok(Math.abs(distToLong - 13) < 0.5);
});

test('Edge Geometry: distance stays correct under CSS zoom (bbox mapping wins over CTM)', async () => {
  const { getDistanceToSvgPath } = await import('../src/utils/edgeGeometry');

  // User-space segment (0,50)..(100,50) painted at 2x zoom, i.e. client
  // (0,100)..(200,100). getScreenCTM does not see the wrapper's CSS zoom and
  // wrongly claims identity — the getBBox mapping must take precedence.
  const zoomedEl: any = {
    getBoundingClientRect: () => ({
      left: 0, right: 200, top: 98, bottom: 102, width: 200, height: 4,
    }),
    getBBox: () => ({ x: 0, y: 50, width: 100, height: 0 }),
    getScreenCTM: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
    getTotalLength: () => 100,
    getPointAtLength: (len: number) => ({ x: len, y: 50 }),
  };

  // Cursor at (100,102) is 2px below the zoomed line (identity CTM would say ~52px).
  const dist = getDistanceToSvgPath(zoomedEl, 100, 102);
  assert.ok(Math.abs(dist - 2) < 0.5, `Expected dist ~2 under zoom, got ${dist}`);
});


test('Edge Matching: parallel edges between same nodes resolve via numeric suffix', () => {
  const parallel: MermaidEdgeDef[] = [
    { type: 'edge', id: 'e0', from: 'A', to: 'B', arrowType: 'arrow' },
    { type: 'edge', id: 'e1', from: 'A', to: 'B', arrowType: 'arrow' },
    { type: 'edge', id: 'e2', from: 'A', to: 'B', arrowType: 'arrow' },
  ];

  // Regression: L_A_B_1 used to return the first edge (e0), making the
  // second parallel edge unselectable and label edits hit the wrong edge.
  assert.strictEqual(matchSvgEdgeToAst({ id: 'L_A_B_0' }, parallel)?.id, 'e0');
  assert.strictEqual(matchSvgEdgeToAst({ id: 'L_A_B_1' }, parallel)?.id, 'e1');
  assert.strictEqual(matchSvgEdgeToAst({ id: 'L_A_B_2' }, parallel)?.id, 'e2');

  // Mermaid v9 hyphenated ids normalize the same way.
  assert.strictEqual(matchSvgEdgeToAst({ id: 'L-A-B-1' }, parallel)?.id, 'e1');

  // Stale suffix beyond the edge list falls back to the first match.
  assert.strictEqual(matchSvgEdgeToAst({ id: 'L_A_B_9' }, parallel)?.id, 'e0');

  // Unsuffixed ids still match the single/first edge.
  assert.strictEqual(matchSvgEdgeToAst({ id: 'L_A_B' }, parallel)?.id, 'e0');
});
