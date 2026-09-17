import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import {
  getCleanSvgElement,
  serializeCleanSvg,
  serializeSvgForPng,
  resolveThemeBackgroundColor,
} from '../src/canvas/utils/exportDiagram';

const dom = new JSDOM('<!DOCTYPE html><html><body class="theme-dark"></body></html>');
(global as any).window = dom.window;
(global as any).document = dom.window.document;
(global as any).XMLSerializer = dom.window.XMLSerializer;
(global as any).getComputedStyle = dom.window.getComputedStyle;

test('Export Diagram: getCleanSvgElement strips editor overlays and preserves cluster element', () => {
  const mount = document.createElement('div');
  mount.innerHTML = `
    <svg width="400" height="250" viewBox="0 0 400 250">
      <g class="node mermaid-node-selection-halo"><rect width="50" height="50"/></g>
      <g class="cluster mermaid-cluster-selected" id="subgraph1"><rect width="200" height="150"/></g>
      <g class="edge mermaid-drop-target"><path d="M0,0 L10,10"/></g>
      <path class="mermaid-edge-hit-area" d="M0,0 L10,10" />
    </svg>
  `;

  const res = getCleanSvgElement(mount);
  assert.ok(res !== null, 'Clean SVG result should not be null');
  assert.equal(res.width, 400);
  assert.equal(res.height, 250);

  // Overlay elements (halo, hit-area) must be stripped
  const halo = res.svg.querySelector('.mermaid-node-selection-halo');
  assert.equal(halo, null, 'Halo elements should be stripped');

  const hitArea = res.svg.querySelector('.mermaid-edge-hit-area');
  assert.equal(hitArea, null, 'Hit-area path elements should be stripped');

  // The cluster element itself must NOT be deleted, only its transient selection class removed
  const cluster = res.svg.querySelector('#subgraph1');
  assert.ok(cluster !== null, 'Cluster element must be preserved');
  assert.equal(cluster.classList.contains('mermaid-cluster-selected'), false, 'Selection class must be cleared');

  // XML namespaces
  assert.equal(res.svg.getAttribute('xmlns'), 'http://www.w3.org/2000/svg');
  assert.equal(res.svg.getAttribute('xmlns:xlink'), 'http://www.w3.org/1999/xlink');
});

test('Export Diagram: SVG export preserves foreignObject with inlined styles', () => {
  const mount = document.createElement('div');
  mount.innerHTML = `
    <svg width="400" height="200" viewBox="0 0 400 200">
      <g class="node" id="node1">
        <rect width="100" height="40" x="50" y="50" />
        <g class="label">
          <foreignObject width="100" height="40" x="50" y="50">
            <div xmlns="http://www.w3.org/1999/xhtml">
              <span class="nodeLabel">Process Step</span>
            </div>
          </foreignObject>
        </g>
      </g>
    </svg>
  `;

  const res = serializeCleanSvg(mount);
  assert.ok(res !== null);

  // Vector SVG must preserve foreignObject for 1:1 visual match with Mermaid
  assert.ok(res.svgString.includes('<foreignObject'), 'Vector SVG should preserve foreignObject');
  assert.ok(res.svgString.includes('Process Step'), 'Text content should be present');
});

test('Export Diagram: PNG rasterization SVG converts foreignObjects into native <text> elements', () => {
  const mount = document.createElement('div');
  mount.innerHTML = `
    <svg width="400" height="200" viewBox="0 0 400 200">
      <g class="node" id="node1">
        <rect width="100" height="40" x="50" y="50" />
        <g class="label">
          <foreignObject width="100" height="40" x="50" y="50">
            <div xmlns="http://www.w3.org/1999/xhtml">
              <span class="nodeLabel">Process Step</span>
            </div>
          </foreignObject>
        </g>
      </g>
    </svg>
  `;

  const res = serializeSvgForPng(mount);
  assert.ok(res !== null);

  // For PNG canvas rasterization, foreignObject must be converted to native <text>
  assert.equal(res.svgString.includes('<foreignObject'), false, 'PNG SVG must have no foreignObject');
  assert.ok(res.svgString.includes('<text'), 'PNG SVG must have native <text>');
  assert.ok(res.svgString.includes('x="100"'), 'Native <text> must be centered at x=100 (50 + 100/2)');
  assert.ok(res.svgString.includes('y="70"'), 'Native <text> must be centered at y=70 (50 + 40/2)');
});

test('Export Diagram: converts multiline labels into <text> with <tspan> lines', () => {
  const mount = document.createElement('div');
  mount.innerHTML = `
    <svg width="400" height="200" viewBox="0 0 400 200">
      <g class="label">
        <foreignObject width="120" height="60" x="40" y="40">
          <div xmlns="http://www.w3.org/1999/xhtml">Line 1<br/>Line 2</div>
        </foreignObject>
      </g>
    </svg>
  `;

  const res = serializeSvgForPng(mount);
  assert.ok(res !== null);

  assert.ok(res.svgString.includes('<tspan'), 'Should create tspans for multiline');
  assert.ok(res.svgString.includes('Line 1'), 'Line 1 must be present');
  assert.ok(res.svgString.includes('Line 2'), 'Line 2 must be present');
});

test('Export Diagram: serializeCleanSvg injects background rect matching viewBox coordinates', () => {
  const mount = document.createElement('div');
  mount.innerHTML = `
    <svg viewBox="-20 -15 520 340">
      <g id="node1"><rect width="80" height="40"/></g>
    </svg>
  `;

  const res = serializeCleanSvg(mount, {
    includeBackground: true,
    backgroundColor: '#2b2b2b',
  });

  assert.ok(res !== null, 'Serialized result should not be null');
  assert.equal(res.width, 520);
  assert.equal(res.height, 340);

  // Verify background rect matches exact viewBox coordinates (-20, -15, 520, 340)
  assert.ok(
    res.svgString.includes('class="mermaid-export-background"'),
    'Background rect class must be present'
  );
  assert.ok(res.svgString.includes('x="-20"'), 'Background x must align with viewBox minX');
  assert.ok(res.svgString.includes('y="-15"'), 'Background y must align with viewBox minY');
  assert.ok(res.svgString.includes('width="520"'), 'Background width must match viewBox width');
  assert.ok(res.svgString.includes('height="340"'), 'Background height must match viewBox height');
  assert.ok(res.svgString.includes('fill="#2b2b2b"'), 'Background fill must match requested color');
});

test('Export Diagram: serializeCleanSvg without background does not inject background rect', () => {
  const mount = document.createElement('div');
  mount.innerHTML = `
    <svg viewBox="0 0 300 150">
      <g id="node1"><rect width="80" height="40"/></g>
    </svg>
  `;

  const res = serializeCleanSvg(mount, {
    includeBackground: false,
  });

  assert.ok(res !== null);
  assert.equal(res.svgString.includes('mermaid-export-background'), false);
});

test('Export Diagram: resolveThemeBackgroundColor produces solid opaque color', () => {
  const colorDark = resolveThemeBackgroundColor(null);
  assert.ok(colorDark && colorDark !== 'transparent', 'Dark theme background must be solid');

  document.body.className = 'theme-light';
  const colorLight = resolveThemeBackgroundColor(null);
  assert.ok(colorLight && colorLight !== 'transparent', 'Light theme background must be solid');
});
