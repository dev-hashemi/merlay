import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { getExportSvgResult, serializeCleanSvg } from '../src/canvas/utils/exportDiagram';

const fixtures = JSON.parse(readFileSync(new URL('./fixtures/obsidianPele.json', import.meta.url), 'utf8')) as {
  diagrams: { code: string; svg: string }[];
};

for (const [theme, surface] of [['light', '#f6f6f6'], ['dark', '#282828']]) {
  test(`Pele ${theme} export preserves the host palette and authored colors`, async () => {
    const dom = new JSDOM(`<!doctype html><html><body class="theme-${theme}"></body></html>`);
    Object.assign(globalThis, {
      window: dom.window, document: dom.window.document, DOMParser: dom.window.DOMParser,
      XMLSerializer: dom.window.XMLSerializer, HTMLElement: dom.window.HTMLElement,
    });
    const fixture = fixtures.diagrams[0];
    const raw = fixture.svg.replace('fill="var(--_s)"', 'fill="#ff0000"');
    const mount = document.createElement('div');
    mount.innerHTML = raw;
    document.body.append(mount);
    const themeCss = document.createElement('style');
    themeCss.textContent = `.pele { --pele-surface: ${surface}; --pele-fg: #123456; --pele-series-1: #08b94e; }`;
    document.head.append(themeCss);
    const result = await getExportSvgResult({
      svgMountEl: mount, code: fixture.code, renderMermaid: async () => raw,
    });
    assert.ok(result);
    assert.equal(result.svg.style.getPropertyValue('--pele-surface'), surface);
    assert.equal(result.svg.style.getPropertyValue('--pele-fg'), '#123456');
    assert.equal(result.svg.style.getPropertyValue('--pele-series-1'), '#08b94e');
    assert.ok(result.svg.querySelector('.pele-node rect[fill="#ff0000"]'), 'authored colors must not be inverted');
    assert.equal(result.svg.querySelector('.pele-node text')?.hasAttribute('fill'), false, 'text must retain its native inherited color');
    const clean = serializeCleanSvg(mount);
    assert.ok(clean?.svgString.includes('--pele-surface'));
  });
}
