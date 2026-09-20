/**
 * Mermaid rendering engine backed by the `mermaid` npm package.
 *
 * For hosts WITHOUT a native Mermaid runtime (VS Code webview,
 * standalone web app). The Obsidian host keeps using Obsidian's own
 * bundled Mermaid for 100% native render parity — see
 * `src/obsidian/obsidianMermaid.ts`.
 *
 * NOTE: `mermaid.render()` requires a DOM, so this module must only be
 * imported by browser entries (never by Node tests or the Obsidian
 * bundle — nothing in the Obsidian entry chain imports this file).
 */

import mermaid from 'mermaid';

let initialized = false;
let renderSeq = 0;

function ensureInitialized(): void {
  if (initialized) return;
  mermaid.initialize({ startOnLoad: false, securityLevel: 'strict' });
  initialized = true;
}

/** Render Mermaid code to an SVG string via the bundled mermaid package. */
export async function renderMermaidWithNpm(code: string): Promise<string> {
  ensureInitialized();
  const id = `merlay_npm_${Date.now()}_${++renderSeq}`;
  const result: unknown = await mermaid.render(id, code);
  if (typeof result === 'string') return result;
  const svg = (result as { svg?: unknown }).svg;
  if (typeof svg !== 'string') throw new Error('Mermaid render returned no SVG');
  return svg;
}
