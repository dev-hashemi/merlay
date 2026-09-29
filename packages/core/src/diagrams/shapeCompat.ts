/**
 * Host-renderer shape compatibility probing.
 *
 * Hosts bundle different Mermaid versions (Obsidian's lags npm), so shapes
 * added in newer releases (e.g. person/bucket/console/browser in 11.17.0)
 * throw "No such shape" on old renderers — breaking the whole diagram.
 * Instead of version-string sniffing, probe the host's actual renderer with
 * one diagram containing the gated shapes and binary-isolate the culprits.
 * Parsing/serialization support every shape regardless; only the picker
 * hides what the host cannot render.
 */

import type { RenderMermaidFn } from '../platform/types';

/** Only "No such shape"-style failures mark a shape unsupported (fail open). */
const UNSUPPORTED_SHAPE_ERROR = /no such shape|unknown shape|does not exist/i;

function probeCode(kinds: readonly string[]): string {
  const lines = ['flowchart TD'];
  kinds.forEach((kind, i) => {
    lines.push(`    probe${i}@{ shape: ${kind}, label: "probe" }`);
  });
  return lines.join('\n');
}

/**
 * Returns the subset of `kinds` the host renderer cannot render.
 * One render when everything is supported; binary isolation otherwise.
 */
export async function probeUnsupportedKinds(
  renderMermaid: RenderMermaidFn,
  kinds: readonly string[]
): Promise<string[]> {
  if (kinds.length === 0) return [];
  try {
    await renderMermaid(probeCode(kinds));
    return [];
  } catch (err) {
    if (!UNSUPPORTED_SHAPE_ERROR.test(err instanceof Error ? err.message : String(err))) {
      // Transient/unrelated failure — fail open, hide nothing.
      return [];
    }
    if (kinds.length === 1) return [...kinds];
    const mid = Math.ceil(kinds.length / 2);
    const [left, right] = await Promise.all([
      probeUnsupportedKinds(renderMermaid, kinds.slice(0, mid)),
      probeUnsupportedKinds(renderMermaid, kinds.slice(mid)),
    ]);
    return [...left, ...right];
  }
}
