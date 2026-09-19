import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { scrubSvgForMount } from '../src/canvas/renderer/svgSanitize';

function scrubHtmlOf(inner: string): string {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
  const doc = new dom.window.DOMParser().parseFromString(
    `<svg xmlns="http://www.w3.org/2000/svg">${inner}</svg>`,
    'text/html'
  );
  const svg = doc.querySelector('svg') as unknown as SVGSVGElement;
  scrubSvgForMount(svg);
  return (svg as unknown as Element).outerHTML;
}

test('scrubSvgForMount: removes scripts and inline event handlers', () => {
  const out = scrubHtmlOf(
    '<script>alert(1)</script><g><rect onclick="alert(2)" onload="alert(3)" width="10"/></g>'
  );
  assert.ok(!out.includes('<script'), out);
  assert.ok(!/on(click|load)/i.test(out), out);
});

test('scrubSvgForMount: neutralizes javascript: link targets (incl. case tricks)', () => {
  // Regression: javascript: hrefs survived into the live DOM (stored-XSS surface).
  const out = scrubHtmlOf(
    '<a href="javascript:alert(1)"><text>x</text></a>' +
      '<a href="  JaVaScRiPt:alert(2)"><text>y</text></a>' +
      '<image href="javascript:alert(3)"/>' +
      '<a href="https://example.com"><text>safe</text></a>'
  );
  assert.ok(!/javascript:/i.test(out), out);
  assert.ok(out.includes('https://example.com'), 'safe links preserved: ' + out);
});

test('scrubSvgForMount: removes frame/object embeds but keeps theming and labels', () => {
  const out = scrubHtmlOf(
    '<style>.x{fill:red}</style>' +
      '<iframe src="https://evil.example"></iframe>' +
      '<object data="https://evil.example"></object>' +
      '<foreignObject><div xmlns="http://www.w3.org/1999/xhtml">label</div></foreignObject>'
  );
  assert.ok(!out.includes('<iframe') && !out.includes('<object'), out);
  assert.ok(out.includes('<style>'), 'theme style preserved: ' + out);
  assert.ok(out.includes('<foreignObject>'), 'labels preserved: ' + out);
});
