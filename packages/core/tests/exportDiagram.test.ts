import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import {
  getCleanSvgElement,
  serializeCleanSvg,
  getExportSvgResult,
  svgStringToDataUrl,
  convertForeignObjectsToSvgText,
  resolveThemeBackgroundColor,
  parseSvgString,
} from '../src/canvas/utils/exportDiagram';

const dom = new JSDOM('<!DOCTYPE html><html><body class="theme-dark"></body></html>');
(global as any).window = dom.window;
(global as any).document = dom.window.document;
(global as any).XMLSerializer = dom.window.XMLSerializer;
(global as any).DOMParser = dom.window.DOMParser;
(global as any).HTMLElement = dom.window.HTMLElement;
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

test('Export Diagram: SVG export preserves foreignObject with native Mermaid structure', () => {
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

test('Export Diagram: convertForeignObjectsToSvgText converts foreignObjects into native <text> elements', () => {
  const svgDoc = parseSvgString(`
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
  `);
  assert.ok(svgDoc !== null);

  convertForeignObjectsToSvgText(svgDoc);

  assert.equal(svgDoc.querySelector('foreignObject'), null, 'foreignObject must be removed');
  const textEl = svgDoc.querySelector('text');
  assert.ok(textEl !== null, 'Native <text> element should exist');
  assert.equal(textEl.textContent, 'Process Step');
  assert.equal(textEl.getAttribute('x'), '100'); // 50 + 100/2
  assert.equal(textEl.getAttribute('y'), '70');  // 50 + 40/2
  assert.equal(textEl.getAttribute('text-anchor'), 'middle');
  assert.equal(textEl.getAttribute('dominant-baseline'), 'central');
});

test('Export Diagram: convertForeignObjectsToSvgText converts multiline labels into <text> with <tspan> lines', () => {
  const svgDoc = parseSvgString(`
    <svg width="400" height="200" viewBox="0 0 400 200">
      <g class="label">
        <foreignObject width="120" height="60" x="40" y="40">
          <div xmlns="http://www.w3.org/1999/xhtml">Line 1<br/>Line 2</div>
        </foreignObject>
      </g>
    </svg>
  `);
  assert.ok(svgDoc !== null);

  convertForeignObjectsToSvgText(svgDoc);

  const textEl = svgDoc.querySelector('text');
  assert.ok(textEl !== null);
  const tspans = textEl.querySelectorAll('tspan');
  assert.equal(tspans.length, 2, 'Should create tspans for multiline');
  assert.equal(tspans[0].textContent, 'Line 1');
  assert.equal(tspans[1].textContent, 'Line 2');
});

test('Export Diagram: svgStringToDataUrl encodes SVG to UTF-8 Base64 data URL', () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg"><text>Hello World</text></svg>';
  const dataUrl = svgStringToDataUrl(svg);
  assert.ok(dataUrl.startsWith('data:image/svg+xml;base64,'));

  const base64Part = dataUrl.replace('data:image/svg+xml;base64,', '');
  const decoded = Buffer.from(base64Part, 'base64').toString('utf-8');
  assert.equal(decoded, svg);
});

test('Export Diagram: getExportSvgResult injects background rect matching viewBox coordinates', async () => {
  const mount = document.createElement('div');
  mount.innerHTML = `
    <svg viewBox="-20 -15 520 340">
      <g id="node1"><rect width="80" height="40"/></g>
    </svg>
  `;

  const res = await getExportSvgResult(mount, {
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

test('Export Diagram: getExportSvgResult without background does not inject background rect', async () => {
  const mount = document.createElement('div');
  mount.innerHTML = `
    <svg viewBox="0 0 300 150">
      <g id="node1"><rect width="80" height="40"/></g>
    </svg>
  `;

  const res = await getExportSvgResult(mount, {
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

test('Export Diagram: getExportSvgResult preserves Mermaid <style> tag and custom style directives intact', async () => {
  const mount = document.createElement('div');
  mount.innerHTML = `
    <svg viewBox="0 0 500 300" id="mermaid-diag-1">
      <style>
        #mermaid-diag-1 .node rect { fill: #ECECFF; stroke: #9370DB; }
        #mermaid-diag-1 #flowchart-B-123 .node-bkg { fill: #ccfbf1 !important; stroke: #0d9488 !important; }
      </style>
      <defs>
        <marker id="mermaid-diag-1_pointEnd" viewBox="0 0 10 10" refX="5" refY="5" markerUnits="userSpaceOnUse" markerWidth="8" markerHeight="8" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" class="arrowMarkerPath" style="stroke-width: 1; stroke-dasharray: 1, 0;" />
        </marker>
      </defs>
      <g class="output">
        <g class="node default" id="flowchart-B-123">
          <polygon points="0,0 80,0 70,40 0,40" class="node-bkg label-container" />
          <g class="label">
            <foreignObject width="80" height="40">
              <div xmlns="http://www.w3.org/1999/xhtml">Process</div>
            </foreignObject>
          </g>
        </g>
      </g>
      <path class="mermaid-edge-hit-area" d="M0,0 L10,10" />
    </svg>
  `;

  const res = await getExportSvgResult(mount, { includeBackground: true });
  assert.ok(res !== null);

  // 1. Mermaid <style> must be 100% preserved
  assert.ok(res.svgString.includes('#mermaid-diag-1 .node rect'), 'Style block must be preserved');
  assert.ok(res.svgString.includes('fill: #ccfbf1'), 'Custom node fill style must be preserved');
  assert.ok(res.svgString.includes('stroke: #0d9488'), 'Custom node stroke style must be preserved');

  // 2. Shapes (polygon, marker, text) must be preserved
  assert.ok(res.svgString.includes('<polygon points="0,0 80,0 70,40 0,40"'), 'Custom polygon shape must be preserved');
  assert.ok(res.svgString.includes('<marker id="mermaid-diag-1_pointEnd"'), 'Defs and markers must be preserved');
  assert.ok(res.svgString.includes('>Process</text>'), 'Label text must be preserved as universal <text>');

  // 3. Merlay hit area must be stripped
  assert.ok(!res.svgString.includes('mermaid-edge-hit-area'), 'Hit area must be stripped');

  // 4. Background rect must be present
  assert.ok(res.svgString.includes('class="mermaid-export-background"'), 'Background rect must be present');
});

test('Export Diagram: dark theme renders visible light text and arrows, dark shapes, and preserves custom colors', async () => {
  document.body.className = 'theme-dark';
  const mount = document.createElement('div');
  mount.innerHTML = `
    <svg viewBox="0 0 500 300" id="diag-dark">
      <defs>
        <marker id="diag-dark_pointEnd" class="marker flowchart" viewBox="0 0 10 10" refX="5" refY="5" markerUnits="userSpaceOnUse" markerWidth="8" markerHeight="8" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" class="arrowMarkerPath"></path>
        </marker>
      </defs>
      <g class="output">
        <g class="edgePaths">
          <g class="edgePath"><path class="path" d="M10,10L50,10"></path></g>
        </g>
        <g class="nodes">
          <g class="node default" id="custom-node">
            <rect width="80" height="40" x="10" y="10" style="fill: #ccfbf1; stroke: #0d9488;"></rect>
            <g class="label">
              <foreignObject width="80" height="40" x="10" y="10">
                <div><span class="nodeLabel" style="color: #115e59;">Custom</span></div>
              </foreignObject>
            </g>
          </g>
          <g class="node default" id="default-node">
            <rect width="80" height="40" x="100" y="10" class="label-container"></rect>
            <g class="label">
              <foreignObject width="80" height="40" x="100" y="10">
                <div><span class="nodeLabel">Default</span></div>
              </foreignObject>
            </g>
          </g>
        </g>
      </g>
    </svg>
  `;

  const res = await getExportSvgResult(mount, { includeBackground: true });
  assert.ok(res !== null);

  // 1. Default node has authentic dark navy fill and purple stroke
  assert.ok(res.svgString.includes('fill="#101028"'), 'Default node must have dark navy fill in dark theme');
  assert.ok(res.svgString.includes('stroke="#996df3"'), 'Default node must have dark theme purple border');

  // 2. Custom node colors are mathematically transformed to match canvas appearance
  assert.ok(res.svgString.includes('fill: #001c10'), 'Custom node fill must match on-screen dark emerald');
  assert.ok(res.svgString.includes('stroke: #05ae9f'), 'Custom node stroke must match on-screen cyan');

  // 3. Default arrow path and marker have light grey color
  assert.ok(res.svgString.includes('stroke="#cccccc"'), 'Default arrow path must be light grey in dark theme');
  assert.ok(res.svgString.includes('fill="#cccccc"'), 'Default marker must be light grey in dark theme');

  // 4. Default text is light (#cccccc) and custom text is bright cyan (#66c7c0)
  assert.ok(res.svgString.includes('fill="#cccccc"'), 'Default text must be light in dark theme');
  assert.ok(res.svgString.includes('>Default</text>'), 'Default label text must be present');
  assert.ok(res.svgString.includes('fill="#66c7c0"'), 'Custom text color must be transformed to bright cyan');
  assert.ok(res.svgString.includes('>Custom</text>'), 'Custom label text must be present');
});

test('Export Diagram: transformColorForDarkMode produces bit-exact W3C filter transformation', async () => {
  const { transformColorForDarkMode, transformCssColors } = await import('../src/canvas/utils/exportDiagram');

  assert.equal(transformColorForDarkMode('#333333'), '#cccccc', 'Dark line/text -> light grey');
  assert.equal(transformColorForDarkMode('#ECECFF'), '#101028', 'Lavender node -> dark navy');
  assert.equal(transformColorForDarkMode('#ccfbf1'), '#001c10', 'Light teal -> dark emerald');
  assert.equal(transformColorForDarkMode('#0d9488'), '#05ae9f', 'Dark teal stroke -> vivid cyan');
  assert.equal(transformColorForDarkMode('#115e59'), '#66c7c0', 'Dark pine text -> bright cyan');
  assert.equal(transformColorForDarkMode('#334155'), '#b0c1da', 'Slate-700 -> light slate');
  assert.equal(transformColorForDarkMode('white'), '#000000', 'White -> black');
  assert.equal(transformColorForDarkMode('black'), '#ffffff', 'Black -> white');
  assert.equal(transformColorForDarkMode('rgb(51, 51, 51)'), '#cccccc', 'RGB dark line -> light grey');

  // CSS selector safety
  const css = '#c0ffee .node rect { fill: #ECECFF; stroke: #9370DB; }';
  const transformed = transformCssColors(css);
  assert.ok(transformed.includes('#c0ffee'), 'ID selector #c0ffee must be preserved intact');
  assert.ok(transformed.includes('fill: #101028'), 'Property fill color must be transformed');
  assert.ok(transformed.includes('stroke: #996df3'), 'Property stroke color must be transformed');
});

test('Export Diagram: inlines presentation attributes on edges and markers even when <style> block is present', async () => {
  document.body.className = 'theme-dark';
  const mount = document.createElement('div');
  mount.innerHTML = `
    <svg viewBox="0 0 500 300" id="mermaid-with-style">
      <style>
        #mermaid-with-style .edgePath .path { stroke: #333333; fill: none; }
        #mermaid-with-style .arrowMarkerPath { fill: #333333; }
      </style>
      <defs>
        <marker id="flowchart-pointEnd" class="marker flowchart" viewBox="0 0 10 10" refX="5" refY="5" markerUnits="userSpaceOnUse" markerWidth="8" markerHeight="8" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" class="arrowMarkerPath" style="stroke-width: 1; stroke-dasharray: 1, 0;"></path>
        </marker>
      </defs>
      <g class="output">
        <g class="edgePaths">
          <g class="edgePath LS-A LE-B" id="L-A-B-0">
            <path class="path" d="M10,10L50,10" marker-end="url(#flowchart-pointEnd)" style="fill:none;"></path>
          </g>
        </g>
      </g>
    </svg>
  `;

  const res = await getExportSvgResult(mount, { includeBackground: true });
  assert.ok(res !== null);

  // Edge path must have explicit stroke, stroke-width, fill="none"
  assert.ok(res.svgString.includes('stroke="#cccccc"'), 'Edge path must have explicit stroke attribute');
  assert.ok(res.svgString.includes('fill="none"'), 'Edge path must have explicit fill="none"');
  assert.ok(res.svgString.includes('stroke-width="1.5"'), 'Edge path must have explicit stroke-width attribute');

  // Marker and child path must have explicit fill and stroke attributes
  const doc = parseSvgString(res.svgString);
  assert.ok(doc !== null);
  const marker = doc.querySelector('#flowchart-pointEnd');
  assert.ok(marker !== null, 'Marker must exist');
  assert.equal(marker.getAttribute('fill'), '#cccccc', 'Marker fill must be set to #cccccc');
  assert.equal(marker.getAttribute('stroke'), '#cccccc', 'Marker stroke must be set to #cccccc');

  const markerChild = marker.querySelector('path');
  assert.ok(markerChild !== null);
  assert.equal(markerChild.getAttribute('fill'), '#cccccc', 'Marker child fill must be #cccccc');
  assert.equal(markerChild.getAttribute('stroke'), '#cccccc', 'Marker child stroke must be #cccccc');
});

test('Export Diagram: state diagrams with .transition paths and barbEnd markers have visible presentation attributes', async () => {
  document.body.className = 'theme-dark';
  const mount = document.createElement('div');
  mount.innerHTML = `
    <svg viewBox="0 0 500 300" id="statediagram-export">
      <defs>
        <marker id="vmm_123_stateDiagram-barbEnd" class="marker statediagram" viewBox="0 0 10 10" refX="5" refY="5" markerUnits="userSpaceOnUse" markerWidth="8" markerHeight="8" orient="auto">
          <path d="M 19,7 L9,13 L14,7 L9,1 Z" style="stroke-width: 1; stroke-dasharray: 1, 0;"></path>
        </marker>
      </defs>
      <g>
        <path id="edge0" class="edge-thickness-normal edge-pattern-solid transition" style="fill:none;" marker-end="url(#vmm_123_stateDiagram-barbEnd)" d="M10,20L100,20"></path>
      </g>
    </svg>
  `;

  const res = await getExportSvgResult(mount, { includeBackground: true });
  assert.ok(res !== null);

  const doc = parseSvgString(res.svgString);
  assert.ok(doc !== null);

  const edgePath = doc.querySelector('#edge0');
  assert.ok(edgePath !== null, 'Transition edge must exist');
  assert.equal(edgePath.getAttribute('stroke'), '#cccccc', 'Transition path must have #cccccc stroke in dark theme');
  assert.equal(edgePath.getAttribute('fill'), 'none', 'Transition path must have fill="none"');

  const barbMarker = doc.querySelector('#vmm_123_stateDiagram-barbEnd');
  assert.ok(barbMarker !== null, 'Barb marker must exist');
  assert.equal(barbMarker.getAttribute('fill'), '#cccccc', 'Barb marker must have #cccccc fill');
  const barbPath = barbMarker.querySelector('path');
  assert.ok(barbPath !== null);
  assert.equal(barbPath.getAttribute('fill'), '#cccccc', 'Barb path must have #cccccc fill');
  assert.equal(barbPath.getAttribute('stroke'), '#cccccc', 'Barb path must have #cccccc stroke');
});

test('Export Diagram: custom styled edge produces color-matched cloned marker', async () => {
  document.body.className = 'theme-dark';
  const mount = document.createElement('div');
  mount.innerHTML = `
    <svg viewBox="0 0 600 300" id="custom-link-export">
      <defs>
        <marker id="flowchart-pointEnd" class="marker flowchart" viewBox="0 0 10 10" refX="5" refY="5">
          <path d="M 0 0 L 10 5 L 0 10 z" class="arrowMarkerPath"></path>
        </marker>
      </defs>
      <g class="edgePaths">
        <!-- Edge 0: Default line -->
        <g class="edgePath" id="edge-0">
          <path class="path" d="M10,10L50,10" marker-end="url(#flowchart-pointEnd)"></path>
        </g>
        <!-- Edge 1: Custom colored line (teal #0d9488 -> dark mode #05ae9f) -->
        <g class="edgePath" id="edge-1" style="stroke: #0d9488;">
          <path class="path" d="M10,50L50,50" marker-end="url(#flowchart-pointEnd)"></path>
        </g>
      </g>
    </svg>
  `;

  const res = await getExportSvgResult(mount, { includeBackground: true });
  assert.ok(res !== null);

  const doc = parseSvgString(res.svgString);
  assert.ok(doc !== null);

  // Edge 0 should keep base marker with default #cccccc
  const baseMarker = doc.querySelector('#flowchart-pointEnd');
  assert.ok(baseMarker !== null);
  assert.equal(baseMarker.getAttribute('fill'), '#cccccc');

  // Edge 1 should have transformed stroke (#05ae9f) and cloned marker
  const edge1Path = doc.querySelector('#edge-1 path');
  assert.ok(edge1Path !== null);
  assert.equal(edge1Path.getAttribute('stroke'), '#05ae9f');

  const edge1MarkerRef = edge1Path.getAttribute('marker-end');
  assert.ok(edge1MarkerRef && edge1MarkerRef.includes('_05ae9f'), 'Edge 1 should reference cloned marker matching color');

  // Verify the cloned marker exists in defs with matching #05ae9f fill & stroke
  const clonedMarkerId = edge1MarkerRef.match(/url\(#([^)]+)\)/)?.[1];
  assert.ok(clonedMarkerId);
  const clonedMarker = doc.querySelector(`#${clonedMarkerId}`);
  assert.ok(clonedMarker !== null, 'Cloned marker must exist in SVG');
  assert.equal(clonedMarker.getAttribute('fill'), '#05ae9f');
  assert.equal(clonedMarker.getAttribute('stroke'), '#05ae9f');
  assert.equal(clonedMarker.parentElement?.tagName.toLowerCase(), 'defs', 'Cloned marker must be in defs');
});

test('Export Diagram: relocates orphaned markers into <defs>', async () => {
  const mount = document.createElement('div');
  mount.innerHTML = `
    <svg viewBox="0 0 300 150">
      <!-- Marker outside defs -->
      <marker id="orphan-marker" viewBox="0 0 10 10">
        <path d="M0,0L10,5L0,10z"/>
      </marker>
      <g class="edgePath">
        <path class="path" d="M10,10L50,10" marker-end="url(#orphan-marker)"/>
      </g>
    </svg>
  `;

  const res = await getExportSvgResult(mount, { includeBackground: true });
  assert.ok(res !== null);

  const doc = parseSvgString(res.svgString);
  assert.ok(doc !== null);
  const marker = doc.querySelector('#orphan-marker');
  assert.ok(marker !== null);
  assert.equal(marker.parentElement?.tagName.toLowerCase(), 'defs', 'Orphaned marker must be moved inside defs');
});

test('Export Diagram: invisible positioning links remain invisible', async () => {
  const mount = document.createElement('div');
  mount.innerHTML = `
    <svg viewBox="0 0 300 150">
      <defs><marker id="m1"><path d="M0,0L10,5L0,10z"/></marker></defs>
      <g class="edgePath edge-thickness-invisible">
        <path class="path" d="M10,10L50,10" marker-end="url(#m1)"/>
      </g>
    </svg>
  `;

  const res = await getExportSvgResult(mount, { includeBackground: true });
  assert.ok(res !== null);

  const doc = parseSvgString(res.svgString);
  assert.ok(doc !== null);
  const invisibleEdge = doc.querySelector('.edge-thickness-invisible path');
  assert.ok(invisibleEdge !== null);
  assert.equal(invisibleEdge.getAttribute('stroke'), 'none', 'Invisible link stroke must remain none');
});

test('Export Diagram: sequence diagram actors, stick figures, lifelines, and autonumber render with exact theme colors and orientation', async () => {
  document.body.className = 'theme-dark';
  const mount = document.createElement('div');
  mount.innerHTML = `
    <svg viewBox="-50 -10 500 450">
      <defs>
        <marker id="arrowhead" refX="7.9" refY="5" markerWidth="12" markerHeight="12" orient="auto-start-reverse">
          <path d="M -1 0 L 10 5 L 0 10 z" />
        </marker>
        <marker id="sequencenumber" refX="15" refY="15" markerWidth="60" markerHeight="40" orient="auto">
          <circle cx="15" cy="15" r="6" fill="#cccccc" stroke="#cccccc"/>
        </marker>
      </defs>
      <!-- Actor box (Bob) -->
      <g>
        <rect x="250" y="30" fill="#eaeaea" stroke="#666666" width="150" height="65" class="actor actor-top" />
        <text class="actor actor-box" x="325" y="62"><tspan x="325">Bob</tspan></text>
      </g>
      <!-- Lifeline -->
      <line id="actor-bob" x1="325" y1="95" x2="325" y2="350" class="actor-line" stroke="#666666" />
      <!-- Actor stick figure (Alice) -->
      <g class="actor-man actor-top" name="Alice">
        <line id="actor-man-torso" x1="80" y1="57" x2="80" y2="77"/>
        <line id="actor-man-arms" x1="62" y1="65" x2="98" y2="65"/>
        <circle cx="80" cy="42" r="15"/>
        <text class="actor actor-man" x="80" y="99"><tspan x="80">Alice</tspan></text>
      </g>
      <!-- Message line with autonumber -->
      <line x1="80" y1="150" x2="325" y2="150" class="messageLine0" marker-end="url(#arrowhead)"/>
      <line x1="80" y1="150" x2="80" y2="150" marker-start="url(#sequencenumber)"/>
      <text x="80" y="154" class="sequenceNumber">1</text>
      <!-- Dotted return message -->
      <line x1="325" y1="200" x2="80" y2="200" class="messageLine1" marker-end="url(#arrowhead)"/>
    </svg>
  `;

  const res = await getExportSvgResult(mount, { includeBackground: true });
  assert.ok(res !== null);
  const doc = parseSvgString(res.svgString);
  assert.ok(doc !== null);

  // 1. Bob's box has authentic dark navy fill and purple stroke (not dull #151515 grey!)
  const bobRect = doc.querySelector('rect.actor');
  assert.ok(bobRect !== null);
  assert.equal(bobRect.getAttribute('fill'), '#101028', 'Actor box must have theme navy fill');
  assert.equal(bobRect.getAttribute('stroke'), '#996df3', 'Actor box must have theme purple stroke');

  // 2. Bob's lifeline has authentic theme purple stroke
  const lifeline = doc.querySelector('line.actor-line');
  assert.ok(lifeline !== null);
  assert.equal(lifeline.getAttribute('stroke'), '#996df3', 'Lifeline must have theme purple stroke');

  // 3. Alice stick figure lines and circle have explicit theme strokes
  const torso = doc.querySelector('#actor-man-torso');
  assert.ok(torso !== null);
  assert.equal(torso.getAttribute('stroke'), '#996df3', 'Torso must have theme purple stroke');
  assert.equal(torso.getAttribute('stroke-width'), '2');

  const head = doc.querySelector('.actor-man circle');
  assert.ok(head !== null);
  assert.equal(head.getAttribute('stroke'), '#996df3', 'Head must have theme purple stroke');
  assert.equal(head.getAttribute('fill'), '#101028', 'Head must have theme navy fill');

  // 4. Autonumber text is black for high contrast against light circle
  const seqNum = doc.querySelector('.sequenceNumber');
  assert.ok(seqNum !== null);
  assert.equal(seqNum.getAttribute('fill'), '#000000', 'Autonumber text must be black');

  // 5. Arrowhead orient="auto-start-reverse" is converted to universal "auto"
  const marker = doc.querySelector('#arrowhead');
  assert.ok(marker !== null);
  assert.equal(marker.getAttribute('orient'), 'auto', 'Marker orient must be auto for QtSvg compatibility');

  // 6. Dotted return message line has explicit stroke-dasharray attribute
  const dottedLine = doc.querySelector('.messageLine1');
  assert.ok(dottedLine !== null);
  assert.equal(dottedLine.getAttribute('stroke-dasharray'), '3, 3');
});

test('Export Diagram: flowchart foreignObject converted to clean SVG text without !important and with proper positioning', async () => {
  document.body.className = 'theme-dark';
  const mount = document.createElement('div');
  mount.innerHTML = `
    <svg viewBox="0 0 300 200">
      <g class="node default" id="flowchart-A-0" transform="translate(100, 50)">
        <circle class="basic label-container" r="25" cx="0" cy="0" />
        <g class="label" transform="translate(-15, -12)">
          <rect width="30" height="24" />
          <foreignObject width="30" height="24">
            <div xmlns="http://www.w3.org/1999/xhtml">
              <span class="nodeLabel">Start</span>
            </div>
          </foreignObject>
        </g>
      </g>
    </svg>
  `;

  const res = await getExportSvgResult(mount, { includeBackground: true });
  assert.ok(res !== null);

  // SVG must NOT contain foreignObject anymore
  assert.ok(!res.svgString.includes('<foreignObject'));

  const doc = parseSvgString(res.svgString);
  assert.ok(doc !== null);

  // Text element must exist with valid coordinates
  const textEl = doc.querySelector('text');
  assert.ok(textEl !== null);
  assert.equal(textEl.textContent, 'Start');
  assert.equal(textEl.getAttribute('x'), '15'); // 0 + 30/2
  assert.equal(textEl.getAttribute('y'), '12'); // 0 + 24/2
  assert.equal(textEl.getAttribute('fill'), '#cccccc');
  // Must NOT contain !important in inline style (which breaks QtSvg)
  const styleVal = textEl.getAttribute('style') || '';
  assert.ok(!styleVal.includes('!important'), 'Inline style must not contain !important');

  // The label background rect must NOT be styled with node fill
  const labelRect = doc.querySelector('.label rect');
  if (labelRect) {
    assert.notEqual(labelRect.getAttribute('fill'), '#101028', 'Label rect must not be styled as node shape');
  }
});



