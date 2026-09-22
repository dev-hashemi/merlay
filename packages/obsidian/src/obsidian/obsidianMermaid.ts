/**
 * Obsidian-backed Mermaid rendering engine.
 *
 * Uses Obsidian's native bundled Mermaid (`loadMermaid()`, falling back to
 * `MarkdownRenderer`) so the visual editor renders pixel-identical output to
 * Obsidian's own preview. Implements `HostAdapter.renderMermaid` — see
 * `src/obsidian/obsidianHost.ts`.
 */

import { App, MarkdownRenderer, Component, loadMermaid } from 'obsidian';

export interface MermaidRenderResult {
  svg: string;
}

export interface MermaidApi {
  render(id: string, text: string, container?: HTMLElement): Promise<MermaidRenderResult | string>;
}

let cachedMermaidApi: MermaidApi | null = null;

export async function getMermaidApi(): Promise<MermaidApi | null> {
  if (cachedMermaidApi) return cachedMermaidApi;
  if (typeof window !== 'undefined' && (window as unknown as { mermaid?: MermaidApi }).mermaid) {
    cachedMermaidApi = (window as unknown as { mermaid?: MermaidApi }).mermaid ?? null;
    return cachedMermaidApi;
  }
  try {
    const loaded: unknown = await loadMermaid();
    cachedMermaidApi = (loaded as MermaidApi).render ? (loaded as MermaidApi) : null;
    return cachedMermaidApi;
  } catch (err) {
    console.warn(
      'Merlay: Direct loadMermaid not available, fallback to MarkdownRenderer',
      err
    );
    return null;
  }
}

let renderSeq = 0;

export async function renderMermaidSvg(app: App, code: string): Promise<string> {
  const mermaidApi = await getMermaidApi();
  if (mermaidApi && typeof mermaidApi.render === 'function') {
    const id = `vmm_${Date.now()}_${++renderSeq}`;
    const scratch = createDiv({ cls: 'mermaid' });
    Object.assign(scratch.style, {
      position: 'absolute',
      visibility: 'hidden',
      top: '-9999px',
      left: '-9999px',
      width: 'auto',
      maxWidth: 'none',
      overflow: 'visible',
    });
    document.body.appendChild(scratch);

    try {
      const res: MermaidRenderResult | string = await mermaidApi.render(id, code, scratch);
      scratch.remove();
      return typeof res === 'string' ? res : res.svg;
    } catch (err) {
      scratch.remove();
      throw err;
    }
  }

  // Fallback to MarkdownRenderer if direct API is unavailable
  const tempContainer = createDiv();
  const comp = new Component();
  comp.load();
  try {
    await MarkdownRenderer.render(
      app,
      `\`\`\`mermaid\n${code}\n\`\`\``,
      tempContainer,
      '',
      comp
    );
    return tempContainer.innerHTML;
  } finally {
    comp.unload();
    tempContainer.remove();
  }
}
