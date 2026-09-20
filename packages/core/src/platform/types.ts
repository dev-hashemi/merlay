/**
 * Platform seam: the only contract between portable core
 * (`diagrams/`, `canvas/`, `utils/`) and a host application
 * (Obsidian plugin, VS Code extension, web app).
 *
 * Core code must depend ONLY on these interfaces — never on
 * `obsidian`, `vscode`, or any host DOM extensions.
 * Each host provides an implementation (see `src/obsidian/obsidianHost.ts`).
 */

export type NotifyFn = (message: string) => void;

export type RenderMermaidFn = (code: string) => Promise<string>;

export type UnsubscribeFn = () => void;

export interface HostAdapter {
  /** Render Mermaid code to an SVG string using the host's engine. */
  renderMermaid: RenderMermaidFn;
  /** Show a transient message (Obsidian Notice, VS Code toast, console). */
  notify: NotifyFn;
  /**
   * Subscribe to host theme changes (dark/light, CSS swap).
   * Returns an unsubscribe function, mirroring useEffect cleanup.
   */
  subscribeTheme: (cb: () => void) => UnsubscribeFn;
}
