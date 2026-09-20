import test from 'node:test';
import assert from 'node:assert';
import { JSDOM } from 'jsdom';
import { normalizeSvgDimensions } from '../src/canvas/renderer/svgDimensions';

/**
 * Obsidian augments SVGElement with setCssStyles at runtime; jsdom lacks it,
 * so install a faithful mock (assigns onto the element's inline style).
 */
function withObsidianCssHelpers(svg: SVGSVGElement): void {
  const el = svg as unknown as {
    setCssStyles?: (styles: Record<string, string>) => void;
  };
  if (typeof el.setCssStyles !== 'function') {
    el.setCssStyles = function (styles: Record<string, string>) {
      Object.assign((this as SVGSVGElement).style, styles);
    };
  }
}

test('normalizeSvgDimensions: sets natural width and height from viewBox and overrides max-width', () => {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
  const doc = dom.window.document;
  const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg') as unknown as SVGSVGElement;
  svg.setAttribute('viewBox', '-8 -8 1500 900');
  svg.setAttribute('width', '100%');
  svg.style.maxWidth = '1500px';
  withObsidianCssHelpers(svg);

  normalizeSvgDimensions(svg);

  assert.strictEqual(svg.getAttribute('width'), '1500');
  assert.strictEqual(svg.getAttribute('height'), '900');
  assert.strictEqual(svg.style.getPropertyValue('width'), '1500px');
  assert.strictEqual(svg.style.getPropertyValue('height'), '900px');
  assert.strictEqual(svg.style.getPropertyValue('min-width'), '1500px');
  assert.strictEqual(svg.style.getPropertyValue('min-height'), '900px');
  assert.strictEqual(svg.style.getPropertyValue('max-width'), 'none');
  // No inline priority flag: the max-width override lives in styles.css
  // (#merlay-svg-mount.mermaid-native-svg-mount svg).
  assert.strictEqual(svg.style.getPropertyPriority('max-width'), '');
  assert.strictEqual(svg.style.getPropertyPriority('width'), '');
});

test('normalizeSvgDimensions: falls back to style.maxWidth when viewBox is missing', () => {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
  const doc = dom.window.document;
  const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg') as unknown as SVGSVGElement;
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '400');
  svg.style.maxWidth = '850px';
  withObsidianCssHelpers(svg);

  normalizeSvgDimensions(svg);

  assert.strictEqual(svg.getAttribute('width'), '850');
  assert.strictEqual(svg.getAttribute('height'), '400');
  assert.strictEqual(svg.style.getPropertyValue('width'), '850px');
  assert.strictEqual(svg.style.getPropertyValue('height'), '400px');
  assert.strictEqual(svg.style.getPropertyValue('max-width'), 'none');
});

test('SVG mount: parsed SVG gets normalized 1:1 dimensions without shrinking in container', () => {
  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="mount" class="mermaid-native-svg-mount mermaid"></div></body></html>');
  const mountEl = dom.window.document.getElementById('mount') as HTMLElement;
  const rawSvgHtml = '<svg id="vmm_test" width="100%" style="max-width: 2800px;" viewBox="0 0 2800 1600"><g class="node"><rect width="120" height="40"></rect></g></svg>';

  const doc = new dom.window.DOMParser().parseFromString(rawSvgHtml, 'text/html');
  const svg = doc.querySelector('svg') as SVGSVGElement;
  withObsidianCssHelpers(svg);
  normalizeSvgDimensions(svg);
  mountEl.append(dom.window.document.importNode(svg, true));

  const mountedSvg = mountEl.querySelector('svg');
  assert.ok(mountedSvg, 'SVG must be mounted');
  assert.strictEqual(mountedSvg.getAttribute('width'), '2800');
  assert.strictEqual(mountedSvg.getAttribute('height'), '1600');
  assert.strictEqual(mountedSvg.style.getPropertyValue('width'), '2800px');
  assert.strictEqual(mountedSvg.style.getPropertyValue('height'), '1600px');
  assert.strictEqual(mountedSvg.style.getPropertyValue('min-width'), '2800px');
  assert.strictEqual(mountedSvg.style.getPropertyValue('min-height'), '1600px');
  assert.strictEqual(mountedSvg.style.getPropertyValue('max-width'), 'none');
  assert.strictEqual(mountedSvg.style.getPropertyPriority('max-width'), '');
  assert.strictEqual(mountedSvg.style.getPropertyPriority('width'), '');
  assert.strictEqual(mountedSvg.style.getPropertyPriority('height'), '');
});
