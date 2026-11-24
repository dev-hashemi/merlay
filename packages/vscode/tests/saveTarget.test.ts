import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import * as markdown from '../../core/src/utils/markdownBlock';
import { loadHost } from '../../core/tests/helpers/loadHost';

const code = 'flowchart LR\nA-->B';
const block = `\`\`\`mermaid\n${code}\n\`\`\``;
type Message = { type: string; code?: string };
type Listener = (message: Message) => void;
type SelectionListener = (event: {
  textEditor: { document: { languageId: string } };
  selections: { active: { line: number } }[];
  kind?: number;
}) => void;

async function open(documentText: string, line: number, standalone = false) {
  let text = documentText;
  let version = 0;
  let onMessage: Listener = () => {};
  let onDocumentChange: () => void = () => {};
  let onDispose: () => void = () => {};
  let onSelection: SelectionListener = () => {};
  let editFence: (uri: string, line: number) => Promise<void> = async () => {};
  let openedPanels = 0;
  let blockedOpen: Promise<void> | undefined;
  let applied = 0;
  let rejectWrite = false;
  let blockedWrite: Promise<void> | undefined;
  const messages: Message[] = [];
  const errors: string[] = [];
  const recoveryDocuments: string[] = [];
  const disposable = { dispose() {} };
  const uri = { toString: () => 'file:///note.md', path: '/note.md' };
  const document = {
    uri, languageId: standalone ? 'mermaid' : 'markdown',
    getText: () => text, get lineCount() { return text.split('\n').length; },
    lineAt: (i: number) => ({ text: text.split('\n')[i] }),
  };
  class WorkspaceEdit {
    text = '';
    replace(_uri: unknown, _range: unknown, value: string) { this.text = value; }
  }
  const panel = {
    webview: {
      asWebviewUri: () => '',
      onDidReceiveMessage(listener: Listener) { onMessage = listener; return disposable; },
      postMessage(message: Message) { messages.push(message); },
    },
    onDidDispose(listener: () => void) { onDispose = listener; },
    reveal() {},
  };
  const sdk = {
    Uri: { parse: () => uri, joinPath: () => uri },
    TextEditorSelectionChangeKind: { Keyboard: 1, Mouse: 2, Command: 3 },
    Range: class {}, WorkspaceEdit, ViewColumn: { Active: 1 },
    Disposable: { from: (...items: { dispose(): void }[]) => ({ dispose: () => items.forEach((item) => item.dispose()) }) },
    workspace: {
      openTextDocument: async (request: unknown) => {
        if (blockedOpen) await blockedOpen;
        if (typeof request === 'object' && request !== null && 'content' in request) {
          recoveryDocuments.push(String(request.content));
        }
        return document;
      },
      onDidChangeTextDocument(listener: (event: { document: typeof document }) => void) {
        onDocumentChange = () => listener({ document }); return disposable;
      },
      async applyEdit(edit: WorkspaceEdit) {
        applied++;
        const expectedVersion = version;
        if (blockedWrite) await blockedWrite;
        if (rejectWrite || version !== expectedVersion) return false;
        text = edit.text; version++; onDocumentChange(); return true;
      },
    },
    languages: { registerCodeLensProvider: () => disposable },
    commands: {
      registerCommand(name: string, callback: typeof editFence) {
        if (name === 'merlay.editMermaidFence') editFence = callback;
        return disposable;
      },
    },
    window: {
      createWebviewPanel: () => { openedPanels++; return panel; },
      registerCustomEditorProvider: () => disposable,
      registerUriHandler: () => disposable,
      onDidChangeTextEditorSelection(listener: SelectionListener) {
        onSelection = listener;
        return disposable;
      },
      onDidChangeActiveColorTheme: () => disposable,
      showInformationMessage: () => {},
      showErrorMessage: (message: string) => { errors.push(message); },
      showTextDocument: async () => {},
    },
  };
  const entry = standalone ? '../src/mermaidEditor.ts' : '../src/extension.ts';
  const module = await loadHost(resolve(import.meta.dirname, entry), {
    vscode: sdk, '@merlay/core': markdown,
  }) as typeof import('../src/extension') & typeof import('../src/mermaidEditor');
  if (standalone) {
    await new module.MermaidEditorProvider(uri as never).resolveCustomTextEditor(document as never, panel as never, {} as never);
  } else {
    module.activate({ extensionUri: uri, subscriptions: [] } as never);
    await editFence(uri.toString(), line);
  }
  const flush = () => new Promise<void>((done) => setImmediate(done));
  return {
    send: (code: string) => onMessage({ type: 'merlay/codeChange', code }),
    ready: () => onMessage({ type: 'merlay/ready' }),
    change(value: string) { text = value; version++; onDocumentChange(); },
    get text() { return text; }, get applied() { return applied; }, messages, errors, recoveryDocuments, flush,
    reject(value: boolean) { rejectWrite = value; },
    block(value: Promise<void>) { blockedWrite = value; },
    close() { onDispose(); },
    select(line: number) { onSelection({ textEditor: { document }, selections: [{ active: { line } }] }); },
    reopen: () => editFence(uri.toString(), line),
    get openedPanels() { return openedPanels; },
    blockOpen(value: Promise<void>) { blockedOpen = value; },
  };
}

test('VS Code selection changes after closing the visual editor leave it closed', async () => {
  const session = await open(block, 0);
  session.close();
  session.select(2);
  await session.flush();
  assert.equal(session.openedPanels, 1);
  await session.reopen();
  assert.equal(session.openedPanels, 2);
});

test('VS Code selection changes in flight cannot reopen a closed visual editor', async () => {
  const session = await open(block, 0);
  let releaseOpen = () => {};
  session.blockOpen(new Promise<void>((resolve) => { releaseOpen = resolve; }));
  session.select(2);
  session.close();
  releaseOpen();
  await session.flush();
  assert.equal(session.openedPanels, 1);
});

test('VS Code saves the selected duplicate after source text moves both blocks', async () => {
  const session = await open(`${block}\n\n${block}`, 5);
  session.change(`One\nTwo\nThree\nFour\nFive\n${block}\n\n${block}`);
  session.send('flowchart LR\nA-->Renamed');
  await session.flush();
  assert.equal(session.text, `One\nTwo\nThree\nFour\nFive\n${block}\n\n\`\`\`mermaid\nflowchart LR\nA-->Renamed\n\`\`\``);
});

test('VS Code reports a rejected write and can retry without advancing its saved anchor', async () => {
  const session = await open(block, 0);
  session.reject(true);
  session.send('flowchart LR\nA-->Renamed');
  await session.flush();
  assert.equal(session.text, block);
  assert.equal(session.errors.length, 1);
  session.reject(false);
  session.send('flowchart LR\nA-->Renamed');
  await session.flush();
  assert.equal(session.text, '```mermaid\nflowchart LR\nA-->Renamed\n```');
});

test('VS Code keeps pending edits in the canvas when another document change arrives', async () => {
  const session = await open(block, 0);
  let release: () => void = () => {};
  session.block(new Promise<void>((done) => { release = done; }));
  session.send('flowchart LR\nA-->First');
  await session.flush();
  session.send('flowchart LR\nA-->Second');
  session.change(`${block}\nFooter`);
  assert.equal(session.messages.length, 0, 'must not replace pending canvas edits with old source');
  assert.equal(session.applied, 1, 'writes must be serialized');
  release();
  await session.flush();
  await session.flush();
  assert.equal(session.text, '```mermaid\nflowchart LR\nA-->Second\n```\nFooter');
});

test('VS Code refuses saves after the selected duplicate is deleted', async () => {
  const session = await open(`${block}\n\n${block}`, 5);
  session.change(block);
  session.send('flowchart LR\nA-->Renamed');
  await session.flush();
  assert.equal(session.text, block);
  assert.equal(session.errors.length, 1);
});

test('VS Code opens a recovery document when an unsaved visual editor closes', async () => {
  const session = await open(block, 0);
  session.reject(true);
  session.send('flowchart LR\nA-->Unsaved');
  await session.flush();
  session.close();
  await session.flush();
  assert.deepEqual(session.recoveryDocuments, ['flowchart LR\nA-->Unsaved']);
});

test('VS Code source edits sync to the selected duplicate and become the next save baseline', async () => {
  const session = await open(`${block}\n\n${block}`, 5);
  session.change(`${block}\n\n\`\`\`mermaid\nflowchart LR\nA-->External\n\`\`\``);
  assert.equal(session.messages.at(-1)?.code, 'flowchart LR\nA-->External');
  session.send('flowchart LR\nA-->Updated');
  await session.flush();
  assert.equal(session.text, `${block}\n\n\`\`\`mermaid\nflowchart LR\nA-->Updated\n\`\`\``);
});

test('VS Code refuses an expired opening request instead of opening the first fence', async () => {
  const session = await open(block, 99);
  assert.equal(session.errors.length, 1);
  session.send('flowchart LR\nA-->Updated');
  await session.flush();
  assert.equal(session.text, block);
  assert.equal(session.applied, 0);
});

test('VS Code can initialize its canvas even if the target disappeared during loading', async () => {
  const session = await open(`${block}\n\n${block}`, 5);
  session.change(block);
  session.ready();
  assert.equal(session.messages.at(-1)?.code, code);
});

test('VS Code standalone diagrams report failed writes and recover on close', async () => {
  const session = await open(code, 0, true);
  session.reject(true);
  session.send('flowchart LR\nA-->Unsaved');
  await session.flush();
  assert.equal(session.text, code);
  assert.equal(session.errors.length, 1);
  session.close();
  await session.flush();
  assert.deepEqual(session.recoveryDocuments, ['flowchart LR\nA-->Unsaved']);
});

test('VS Code standalone queued saves preserve concurrent source edits', async () => {
  const session = await open(code, 0, true);
  let release: () => void = () => {};
  session.block(new Promise<void>((done) => { release = done; }));
  session.send('flowchart LR\nA-->First');
  await session.flush();
  session.send('flowchart LR\nA-->Second');
  session.change('flowchart LR\nA-->External');
  release();
  await session.flush();
  await session.flush();
  assert.equal(session.text, 'flowchart LR\nA-->External');
  session.close();
  await session.flush();
  assert.deepEqual(session.recoveryDocuments, ['flowchart LR\nA-->Second']);
});
