import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import mermaid from 'mermaid';
import { NativeMermaidView } from '../src/canvas/NativeMermaidView';
import { useCanvasStore } from '../src/canvas/store/canvasStore';
import { getDriverForCode } from '../src/diagrams/registry';

const initialCode = 'flowchart LR\n    accTitle: Preserve this title\n    %% preserve this comment\n    A[Start]\n    B[Target]\n    C[Next]';
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

async function setup(t: TestContext, source = initialCode) {
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
  const notices: string[] = [];
  const root = createRoot(document.querySelector('#root')!);
  let closed = false;
  const close = async () => {
    if (closed) return;
    closed = true;
    await act(async () => root.unmount());
  };
  t.after(async () => {
    await close();
    window.close();
  });
  const render = (initialCode = source) => act(async () => root.render(createElement(NativeMermaidView, {
    initialCode,
    host: {
      renderMermaid: (code) => {
        if (code === initialCode) return Promise.resolve(initialSvg);
        if (code.includes('e1@')) return mermaid.parse(code).then(() => changedSvg);
        if (!code.includes('preserve this comment')) return Promise.resolve('<svg/>');
        return new Promise((resolve, reject) => requests.push({ code, resolve, reject }));
      },
      notify: (message) => notices.push(message),
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
  return { canvas, world, requests, edits, notices, drop, close, retryRender: render };
}

test('a deferred connection keeps the reflowed diagram visible at the same zoom', async (t) => {
  const { world, requests, edits, drop, retryRender } = await setup(t);
  await drop('A', 'B');
  assert.equal(world.querySelector(cueSelector), null);
  assert.equal(world.style.transform, 'translate(0px, 0px) scale(1)');
  assert.equal(edits.length, 0);
  assert.equal(requests.length, 1);
  await act(async () => requests[0].resolve(changedSvg));
  assert.equal(edits.length, 1);
  assert.match(edits[0], /%% preserve this comment/);
  assert.match(edits[0], /accTitle: Preserve this title/);
  const driver = getDriverForCode(edits[0]);
  assert.deepEqual(driver.project(driver.parse(edits[0])).edges.map(({ from, to }) => [from, to]), [['A', 'B']]);
  assert.equal(requests.length, 1, 'mount the already validated SVG');
  assert.equal(world.style.transform, 'translate(-80px, 0px) scale(1)');
  assert.equal(world.querySelector(cueSelector)?.previousElementSibling?.id, 'L_A_B_0');
  assert.equal(useCanvasStore.getState().selectedEdgeIds.size, 0);
  await retryRender();
  assert.equal(requests[1].code, requests[0].code);
  await act(async () => requests[1].resolve(layout(270, 670, 180, 'A', 'B')));
  assert.equal(world.style.transform, 'translate(-80px, 0px) scale(1)');
});

test('rapid connections validate in order against the last accepted edit', async (t) => {
  const { world, requests, edits, drop } = await setup(t);
  await drop('A', 'B');
  await drop('B', 'C');
  assert.equal(requests.length, 1);
  assert.equal(edits.length, 0);
  assert.equal(world.querySelector('svg')?.getAttribute('data-rect'), '160 100 480 340');
  assert.equal(world.querySelector(cueSelector), null);
  await act(async () => requests[0].resolve(changedSvg));
  assert.equal(requests.length, 2);
  const driver = getDriverForCode(requests[1].code);
  assert.deepEqual(driver.project(driver.parse(requests[1].code)).edges.map(({ from, to }) => [from, to]), [['A', 'B'], ['B', 'C']]);
  assert.equal(edits.length, 1);
  await act(async () => requests[1].resolve(newestSvg));
  assert.equal(edits.length, 2);
  assert.equal(world.querySelector(cueSelector)?.previousElementSibling?.id, 'L_B_C_0');
  assert.equal(world.style.transform, 'translate(-80px, 0px) scale(1)');
});

test('rapid direction toggles each use the latest accepted direction', async (t) => {
  const { requests, edits, canvas } = await setup(t);
  await act(async () => {
    const toggle = canvas.querySelector<HTMLButtonElement>('button[title^="Toggle Flow Direction"]');
    assert.ok(toggle);
    toggle.click();
    toggle.click();
  });
  await act(async () => requests[0].resolve(initialSvg));
  assert.equal(requests.length, 2);
  await act(async () => requests[1].resolve(initialSvg));
  assert.deepEqual(edits.map((code) => code.split('\n')[0]), ['flowchart TD', 'flowchart LR']);
});

test('manual camera movement takes precedence over an in-flight connection', async (t) => {
  const { canvas, world, requests, drop } = await setup(t);
  await drop('A', 'B');
  await act(async () => canvas.dispatchEvent(new window.WheelEvent('wheel', { bubbles: true, deltaX: 25 })));
  await act(async () => requests[0].resolve(changedSvg));
  assert.equal(world.style.transform, 'translate(-25px, 0px) scale(1)');
  assert.equal(world.querySelector(cueSelector)?.previousElementSibling?.id, 'L_A_B_0');
});

test('a rejected connection leaves the diagram intact and can be retried', async (t) => {
  const { world, requests, edits, notices, drop } = await setup(t);
  await drop('A', 'B');
  const error = t.mock.method(console, 'error', () => {});
  await act(async () => requests[0].reject(new Error('render failed')));
  error.mock.restore();
  assert.equal(edits.length, 0);
  assert.equal(notices.length, 1);
  assert.equal(world.querySelector(cueSelector), null);
  await drop('A', 'B');
  assert.equal(requests[1].code, requests[0].code);
  await act(async () => requests[1].resolve(changedSvg));
  assert.equal(edits.length, 1);
  assert.ok(world.querySelector(cueSelector));
});

test('named-edge flowchart survives a visual edit that would emit malformed Mermaid', async (t) => {
  const source = 'flowchart LR\n  A e1@--> B\n  e1@{ animate: true }';
  const { world, edits, notices, drop } = await setup(t, source);
  await mermaid.parse(source);
  const driver = getDriverForCode(source);
  const ast = driver.parse(source);
  driver.mutations.updateNodeLabel(ast, 'B', 'Renamed');
  await assert.rejects(mermaid.parse(driver.serialize(ast)));
  const error = t.mock.method(console, 'error', () => {});
  await drop('B', 'A');
  error.mock.restore();
  assert.deepEqual(edits, []);
  assert.equal(notices.length, 1);
  assert.equal(world.querySelector('svg')?.getAttribute('data-rect'), '160 100 480 340');
  assert.equal(document.querySelector<HTMLButtonElement>('button[title^="Undo"]')?.disabled, true);
});

test('external source changes cancel pending connections and their queued successors', async (t) => {
  const { requests, edits, drop, retryRender } = await setup(t);
  await drop('A', 'B');
  await drop('B', 'C');
  await retryRender('flowchart LR\nX --> Y');
  await act(async () => requests[0].resolve(changedSvg));
  assert.deepEqual(edits, []);
  assert.ok(requests.every(({ code }) => !code.includes('B --> C')));
});

test('renderer error artwork cannot be saved as a visual edit', async (t) => {
  const { requests, edits, notices, drop } = await setup(t);
  await drop('A', 'B');
  await act(async () => requests[0].resolve('<svg><g><path class="error-icon"/><text class="error-text">Syntax error</text></g></svg>'));
  assert.deepEqual(edits, []);
  assert.equal(notices.length, 1);
});

test('closing the editor discards unvalidated visual edits', async (t) => {
  const { requests, edits, notices, drop, close } = await setup(t);
  await drop('A', 'B');
  await close();
  await act(async () => requests[0].resolve(changedSvg));
  assert.deepEqual(edits, []);
  assert.deepEqual(notices, []);
});

test('undo cancels an in-flight connection without adding it to history', async (t) => {
  const { requests, edits, drop } = await setup(t);
  await drop('A', 'B');
  await act(async () => requests[0].resolve(changedSvg));
  await drop('B', 'C');
  await act(async () => document.querySelector<HTMLButtonElement>('button[title^="Undo"]')?.click());
  const snapshot = edits[0];
  await act(async () => requests[1].resolve(newestSvg));
  assert.deepEqual(edits, [snapshot, initialCode]);
  await act(async () => document.querySelector<HTMLButtonElement>('button[title^="Redo"]')?.click());
  assert.deepEqual(edits, [snapshot, initialCode, snapshot]);
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
