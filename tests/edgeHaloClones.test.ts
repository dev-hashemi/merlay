import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import {
  applySelectedEdgeHalos,
  clearEdgeHoverHalos,
  EDGE_HOVERED_CLONE_CLS,
  EDGE_HOVERED_HALO_WIDTH,
  EDGE_SELECTED_CLONE_CLS,
  EDGE_SELECTED_HALO_WIDTH,
  showEdgeHoverHalo,
} from '../src/canvas/renderer/selectionHalo';

/** Mount with a linkStyle-customized edge, a plain edge, a hit-area, and a label. */
function buildMount() {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
  const doc = dom.window.document;

  const mount = doc.createElement('div');
  mount.innerHTML =
    '<svg id="vmm_1" viewBox="0 0 400 200">' +
    '<style>#vmm_1 .edgePaths .path{stroke:#333;stroke-width:1px;}</style>' +
    '<g class="edgePaths"><g class="edgePath">' +
    '<path id="vmm_1-L_A_B_0" class="edge-thickness-normal edge-pattern-solid flowchart-link" d="M0,0 L100,0" style="stroke:#ff0000;stroke-width:4px;fill:none" data-mermaid-edge-id="e0"></path>' +
    '<path class="mermaid-edge-hit-area" d="M0,0 L100,0" data-mermaid-edge-id="e0"></path>' +
    '</g></g>' +
    '<g class="edgePaths"><g class="edgePath">' +
    '<path id="vmm_1-L_B_C_0" class="edge-thickness-normal edge-pattern-dotted flowchart-link" d="M100,0 L200,0" data-mermaid-edge-id="e1"></path>' +
    '</g></g>' +
    '<g class="edgeLabel" data-mermaid-edge-id="e1"><text>Hi</text></g>' +
    '</svg>';
  doc.body.append(mount);
  return { mount: mount as unknown as HTMLElement };
}

test('Edge halo: selected linkStyle edge gets a stripped clone, original untouched', () => {
  const { mount } = buildMount();
  applySelectedEdgeHalos(mount, new Set(['e0']));

  const original = mount.querySelector(
    'path.flowchart-link[data-mermaid-edge-id="e0"]'
  )!;
  // Original keeps its inline user style and gains no recolor class.
  assert.strictEqual(
    original.getAttribute('style'),
    'stroke:#ff0000;stroke-width:4px;fill:none'
  );
  assert.ok(!original.classList.contains('mermaid-edge-selected'));

  const clone = mount.querySelector(
    `path.${EDGE_SELECTED_CLONE_CLS}[data-mermaid-edge-id="e0"]`
  )!;
  assert.ok(clone, 'selected clone must exist');
  // Classes preserved (dash patterns, markers), clone marker added.
  assert.ok(clone.classList.contains('flowchart-link'));
  // Clone carries no user styling: only the widening width we set ourselves
  // (inline stroke-width by design).
  const cloneStyle = clone.getAttribute('style') || '';
  assert.ok(!cloneStyle.includes('#ff0000'), 'user stroke must not leak onto clone');
  assert.ok(!cloneStyle.includes('fill'), 'user fill must not leak onto clone');
  assert.strictEqual(clone.getAttribute('fill'), 'none');
  assert.strictEqual(clone.getAttribute('pointer-events'), 'none');
  assert.strictEqual(clone.getAttribute('d'), 'M0,0 L100,0');
  // Clone widens over the custom 4px edge (max of 3.5 and 4).
  assert.ok(cloneStyle.includes('stroke-width: 4px'), `clone must widen to 4px, got: ${cloneStyle}`);
});

test('Edge halo: plain edge clone uses the default width, label gets the class', () => {
  const { mount } = buildMount();
  applySelectedEdgeHalos(mount, new Set(['e1']));

  const clone = mount.querySelector(
    `path.${EDGE_SELECTED_CLONE_CLS}[data-mermaid-edge-id="e1"]`
  )!;
  assert.ok(clone);
  assert.ok(
    (clone.getAttribute('style') || '').includes(`stroke-width: ${EDGE_SELECTED_HALO_WIDTH}px`),
    `clone must use default width, got: ${clone.getAttribute('style')}`
  );

  const label = mount.querySelector('.edgeLabel[data-mermaid-edge-id="e1"]')!;
  assert.ok(label.classList.contains('mermaid-edge-selected'));
});

test('Edge halo: hit-areas are never cloned; clearing removes clones only', () => {
  const { mount } = buildMount();
  applySelectedEdgeHalos(mount, new Set(['e0', 'e1']));
  assert.strictEqual(
    mount.querySelectorAll(`.${EDGE_SELECTED_CLONE_CLS}`).length,
    2
  );
  assert.strictEqual(
    mount.querySelectorAll(`.mermaid-edge-hit-area.${EDGE_SELECTED_CLONE_CLS}`).length,
    0
  );

  applySelectedEdgeHalos(mount, new Set());
  assert.strictEqual(
    mount.querySelectorAll(`.${EDGE_SELECTED_CLONE_CLS}`).length,
    0
  );
  assert.strictEqual(
    mount.querySelectorAll('.mermaid-edge-selected').length,
    0
  );
  // Originals intact after clear.
  const original = mount.querySelector(
    'path.flowchart-link[data-mermaid-edge-id="e0"]'
  )!;
  assert.strictEqual(
    original.getAttribute('style'),
    'stroke:#ff0000;stroke-width:4px;fill:none'
  );
});

test('Edge halo: hover clone skipped while selected; scoped clearing works', () => {
  const { mount } = buildMount();
  const pathEl = mount.querySelector(
    'path.flowchart-link[data-mermaid-edge-id="e0"]'
  )!;

  showEdgeHoverHalo(mount, pathEl, 'e0');
  const hover = mount.querySelector(
    `.${EDGE_HOVERED_CLONE_CLS}[data-mermaid-edge-id="e0"]`
  )!;
  assert.ok(hover);
  // Hover also widens over the custom 4px edge (max of 3 and 4).
  assert.ok(
    (hover.getAttribute('style') || '').includes('stroke-width: 4px'),
    `hover clone must widen to 4px, got: ${hover.getAttribute('style')}`
  );

  // Selecting removes the hover clone and adds the selected clone.
  applySelectedEdgeHalos(mount, new Set(['e0']));
  assert.strictEqual(
    mount.querySelector(`.${EDGE_HOVERED_CLONE_CLS}[data-mermaid-edge-id="e0"]`),
    null
  );
  assert.ok(
    mount.querySelector(`.${EDGE_SELECTED_CLONE_CLS}[data-mermaid-edge-id="e0"]`)
  );

  // Hover is suppressed while selected.
  showEdgeHoverHalo(mount, pathEl, 'e0');
  assert.strictEqual(
    mount.querySelector(`.${EDGE_HOVERED_CLONE_CLS}[data-mermaid-edge-id="e0"]`),
    null
  );

  // Scoped clear removes only that edge's hover clones.
  const path1 = mount.querySelector(
    'path.flowchart-link[data-mermaid-edge-id="e1"]'
  )!;
  showEdgeHoverHalo(mount, path1, 'e1');
  clearEdgeHoverHalos(mount, 'e1');
  assert.strictEqual(
    mount.querySelector(`.${EDGE_HOVERED_CLONE_CLS}`),
    null
  );
});
