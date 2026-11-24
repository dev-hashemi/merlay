import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { NativeMermaidView } from '../src/canvas/NativeMermaidView';
import { useCanvasStore } from '../src/canvas/store/canvasStore';
import { getDriverForCode } from '../src/diagrams/registry';

const initialCode = 'flowchart LR\n    %% preserve this comment\n    A[Start]\n    B[Target]\n    C[Next]';
const initialSvg = layout(160, 480, 360);
const changedSvg = layout(170, 670, 80, 'A', 'B');
const newestSvg = layout(170, 670, 80, 'B', 'C');
const cueSelector = '.mermaid-edge-added-clone';

function layout(left: number, width: number, sourceX: number, from?: string, to?: string): string {
  return `<svg viewBox="0 0 ${width} 340" data-rect="${left} 100 ${width} 340">
    ${from && to ? `<path id="L_${from}_${to}_0" class="flowchart-link" d="M0 0 L10 0"/>` : ''}
    <g class="nodes">
      <g class="node default" id="flowchart-A-0" data-rect="${sourceX} 180 80 40"><rect/></g>
      <g class="node default" id="flowchart-B-1" data-rect="520 180 80 40"><rect/></g>
      <g class="node default" id="flowchart-C-2" data-rect="620 180 80 40"><rect/></g>
    </g>
  </svg>`;
}

async function setup(t: TestContext) {
  const { window } = new JSDOM('<div id="root"></div>', { pretendToBeVisual: true });
  Object.assign(globalThis, {
    window, document: window.document, DOMParser: window.DOMParser,
    Element: window.Element, HTMLElement: window.HTMLElement, SVGElement: window.SVGElement,
    MouseEvent: window.MouseEvent, IS_REACT_ACT_ENVIRONMENT: true,
  });
  window.Element.prototype.getBoundingClientRect = function () {
    if (this.classList.contains('mermaid-native-editor-root')) return new window.DOMRect(0, 0, 800, 600);
    const [x, y, width, height] = (this.getAttribute('data-rect') ?? '0 0 0 0').split(' ').map(Number);
    const world = this.closest<HTMLElement>('.mermaid-native-world');
    const [, panX = '0', panY = '0'] = world?.style.transform.match(/translate\(([-.\d]+)px, ([-.\d]+)px\)/) ?? [];
    return new window.DOMRect(x + Number(panX), y + Number(panY), width, height);
  };
  const requests: { code: string; resolve: (svg: string) => void; reject: (error: Error) => void }[] = [];
  const edits: string[] = [];
  const root = createRoot(document.querySelector('#root')!);
  t.after(async () => {
    await act(async () => root.unmount());
    window.close();
  });
  const render = () => act(async () => root.render(createElement(NativeMermaidView, {
    initialCode,
    host: {
      renderMermaid: (code) => {
        if (code === initialCode) return Promise.resolve(initialSvg);
        if (!code.includes('preserve this comment')) return Promise.resolve('<svg/>');
        return new Promise((resolve, reject) => requests.push({ code, resolve, reject }));
      },
      notify: () => {},
      subscribeTheme: () => () => {},
    },
    onCodeChange: (code) => edits.push(code),
  })));
  await render();
  const canvas = document.querySelector<HTMLElement>('.mermaid-native-editor-root')!;
  const world = document.querySelector<HTMLElement>('.mermaid-native-world')!;
  async function drop(source: string, target: string, event = 'pointerup') {
    await act(async () => {
      const node = canvas.querySelector(`[data-mermaid-node-id="${target}"]`);
      assert.ok(node, 'target is bound by the SVG adapter');
      useCanvasStore.getState().setConnecting(source);
      node.dispatchEvent(new window.MouseEvent(event, { bubbles: true }));
    });
  }
  return { canvas, world, requests, edits, drop, retryRender: render };
}

test('a deferred connection keeps the reflowed diagram visible at the same zoom', async (t) => {
  const { world, requests, edits, drop, retryRender } = await setup(t);
  await drop('A', 'B');
  assert.equal(world.querySelector(cueSelector), null);
  assert.equal(world.style.transform, 'translate(0px, 0px) scale(1)');
  assert.equal(edits.length, 1);
  assert.match(edits[0], /%% preserve this comment/);
  const driver = getDriverForCode(edits[0]);
  assert.deepEqual(driver.project(driver.parse(edits[0])).edges.map(({ from, to }) => [from, to]), [['A', 'B']]);
  assert.equal(requests.length, 1);
  await act(async () => requests[0].resolve(changedSvg));
  assert.equal(world.style.transform, 'translate(-80px, 0px) scale(1)');
  assert.equal(world.querySelector(cueSelector)?.previousElementSibling?.id, 'L_A_B_0');
  assert.equal(useCanvasStore.getState().selectedEdgeIds.size, 0);
  await retryRender();
  assert.equal(requests[1].code, requests[0].code);
  await act(async () => requests[1].resolve(layout(270, 670, 180, 'A', 'B')));
  assert.equal(world.style.transform, 'translate(-80px, 0px) scale(1)');
});

test('a superseded render cannot mount or consume the newer connection correction', async (t) => {
  const { world, requests, drop } = await setup(t);
  await drop('A', 'B');
  await drop('B', 'C');
  assert.equal(requests.length, 2);
  await act(async () => requests[0].resolve(changedSvg));
  assert.equal(world.querySelector('svg')?.getAttribute('data-rect'), '160 100 480 340');
  assert.equal(world.querySelector(cueSelector), null);
  await act(async () => requests[1].resolve(newestSvg));
  assert.equal(world.querySelector(cueSelector)?.previousElementSibling?.id, 'L_B_C_0');
  assert.equal(world.style.transform, 'translate(-80px, 0px) scale(1)');
});

test('manual camera movement takes precedence over an in-flight connection', async (t) => {
  const { canvas, world, requests, drop } = await setup(t);
  await drop('A', 'B');
  await act(async () => canvas.dispatchEvent(new window.WheelEvent('wheel', { bubbles: true, deltaX: 25 })));
  await act(async () => requests[0].resolve(changedSvg));
  assert.equal(world.style.transform, 'translate(-25px, 0px) scale(1)');
  assert.equal(world.querySelector(cueSelector)?.previousElementSibling?.id, 'L_A_B_0');
});

test('a failed connection render leaves no correction for a retry of the same source', async (t) => {
  const { world, requests, drop, retryRender } = await setup(t);
  await drop('A', 'B');
  const error = t.mock.method(console, 'error', () => {});
  await act(async () => requests[0].reject(new Error('render failed')));
  error.mock.restore();
  await retryRender();
  assert.equal(requests[1].code, requests[0].code);
  await act(async () => requests[1].resolve(changedSvg));
  assert.equal(world.querySelector(cueSelector), null);
  assert.equal(world.style.transform, 'translate(0px, 0px) scale(1)');
});

test('canceled and self-target drops leave no edit or camera request', async (t) => {
  const { world, requests, edits, drop } = await setup(t);
  await drop('A', 'B', 'pointercancel');
  await drop('A', 'A');
  assert.equal(edits.length, 0);
  assert.equal(requests.length, 0);
  assert.equal(world.style.transform, 'translate(0px, 0px) scale(1)');
});

test('the added edge halo expires while the bound edge remains', async (t) => {
  const { world, requests, drop } = await setup(t);
  await drop('A', 'B');
  await act(async () => requests[0].resolve(changedSvg));
  const cue = world.querySelector(cueSelector);
  assert.equal(cue?.getAttribute('pointer-events'), 'none');
  assert.equal(cue?.hasAttribute('data-mermaid-edge-id'), false);
  await new Promise((resolve) => setTimeout(resolve, 1050));
  assert.equal(world.querySelector(cueSelector), null);
  assert.ok(world.querySelector('#L_A_B_0[data-mermaid-edge-id]'));
});
