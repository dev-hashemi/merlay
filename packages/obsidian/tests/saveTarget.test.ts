import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import type { ReactElement } from 'react';
import { JSDOM } from 'jsdom';
import * as markdown from '../../core/src/utils/markdownBlock';
import { loadHost } from '../../core/tests/helpers/loadHost';

const code = 'flowchart LR\nA-->B';
const block = `\`\`\`mermaid\n${code}\n\`\`\``;

async function open(documentText: string, startLine: number) {
  const dom = new JSDOM('<!doctype html><html><body></body></html>');
  Object.defineProperty(globalThis, 'window', { value: dom.window, configurable: true });
  let text = documentText;
  let changeCode: (code: string) => void = () => {};
  let timer: () => void = () => {};
  let rejectWrite = false;
  let blockedWrite: Promise<void> | undefined;
  const notices: string[] = [];
  const recoveries: HTMLElement[] = [];
  // Obsidian extends its elements with these helpers; keep actual DOM nodes.
  function element(tag: string) {
    const el = dom.window.document.createElement(tag);
    return Object.assign(el, {
      addClass: (name: string) => el.classList.add(name),
      empty: () => el.replaceChildren(),
      createEl(tag: string, options: { text?: string; cls?: string; attr?: Record<string, string> } = {}) {
        const child = element(tag);
        if (options.text) child.textContent = options.text;
        if (options.cls) child.className = options.cls;
        for (const [key, value] of Object.entries(options.attr ?? {})) child.setAttribute(key, value);
        el.append(child);
        return child;
      },
    });
  }
  class Modal {
    constructor(public app: unknown) {}
    contentEl = element('div');
    modalEl = element('div');
    onOpen() {}
    onClose() {}
    open() { this.onOpen(); recoveries.push(this.contentEl); return this; }
  }
  class TFile {}
  const file = new TFile();
  const app = {
    vault: {
      getAbstractFileByPath: () => file,
      async process(_file: unknown, update: (text: string) => string) {
        if (blockedWrite) await blockedWrite;
        const updated = update(text);
        if (rejectWrite) throw new Error('Disk write failed');
        text = updated; return text;
      },
    },
  };
  Object.assign(dom.window, {
    setTimeout: (callback: () => void) => { timer = callback; return 1; },
    clearTimeout: () => { timer = () => {}; },
  });
  const module = await loadHost(resolve(import.meta.dirname, '../src/views/MermaidBlockModal.tsx'), {
    obsidian: { Modal, TFile, Notice: class { constructor(message: string) { notices.push(message); } } },
    '@merlay/core': { ...markdown, NativeMermaidView: () => null },
    'react-dom/client': {
      createRoot: () => ({
        render(node: ReactElement<{ onCodeChange: typeof changeCode }>) { changeCode = node.props.onCodeChange; },
        unmount() {},
      }),
    },
  }) as typeof import('../src/views/MermaidBlockModal');
  const modal = new module.MermaidBlockModal(
    app as never, {} as never, 'note.md', { lineStart: startLine, lineEnd: startLine + 3 }, code, documentText
  );
  modal.onOpen();
  return {
    change(value: string) { text = value; },
    edit: (value: string) => changeCode(value),
    save: () => timer(),
    close: () => modal.onClose(),
    flush: () => new Promise<void>((done) => setImmediate(done)),
    get text() { return text; }, notices, recoveries,
    reject(value: boolean) { rejectWrite = value; },
    block(value: Promise<void>) { blockedWrite = value; },
  };
}

test('Obsidian saves the second duplicate after text inserted above moves it', async () => {
  const session = await open(`${block}\n\n${block}`, 5);
  session.change(`One\nTwo\nThree\nFour\nFive\n${block}\n\n${block}`);
  session.edit('flowchart LR\nA-->Renamed');
  session.save();
  await session.flush();
  assert.equal(session.text, `One\nTwo\nThree\nFour\nFive\n${block}\n\n\`\`\`mermaid\nflowchart LR\nA-->Renamed\n\`\`\``);
});

test('Obsidian preserves a recovery copy when closing after the target was deleted', async () => {
  const session = await open(`${block}\n\n${block}`, 5);
  session.change(block);
  session.edit('flowchart LR\nA-->Renamed');
  session.close();
  await session.flush();
  assert.equal(session.text, block);
  assert.equal(session.notices.length, 1);
  assert.equal(session.recoveries.at(-1)?.querySelector('textarea')?.value, 'flowchart LR\nA-->Renamed');
});

test('Obsidian retries after a disk failure without advancing the saved anchor', async () => {
  const session = await open(block, 0);
  session.reject(true);
  session.edit('flowchart LR\nA-->First'); session.save();
  await session.flush();
  assert.equal(session.text, block);
  session.reject(false);
  session.edit('flowchart LR\nA-->Second'); session.save();
  await session.flush();
  assert.equal(session.text, '```mermaid\nflowchart LR\nA-->Second\n```');
});

test('Obsidian commits each queued save before saving newer canvas edits', async () => {
  const session = await open(block, 0);
  let release: () => void = () => {};
  session.block(new Promise<void>((done) => { release = done; }));
  session.edit('flowchart LR\nA-->First'); session.save();
  await session.flush();
  session.edit('flowchart LR\nA-->Second'); session.save();
  release();
  await session.flush();
  assert.equal(session.text, '```mermaid\nflowchart LR\nA-->Second\n```');
  assert.equal(session.notices.length, 0);
});
