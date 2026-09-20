/**
 * Obsidian implementation of the platform `HostAdapter`.
 *
 * The single place where Obsidian APIs meet the portable canvas:
 * rendering via Obsidian's native Mermaid, toasts via Notice,
 * theme sync via the `css-change` workspace event.
 */

import { App, Notice } from 'obsidian';
import type { HostAdapter, UnsubscribeFn } from '../platform/types';
import { renderMermaidSvg } from './obsidianMermaid';

export function createObsidianHost(app: App): HostAdapter {
  return {
    renderMermaid: (code: string) => renderMermaidSvg(app, code),
    notify: (message: string) => {
      new Notice(message);
    },
    subscribeTheme: (cb: () => void): UnsubscribeFn => {
      const ref = app.workspace.on('css-change', cb);
      return () => {
        app.workspace.offref(ref);
      };
    },
  };
}

const hostCache = new WeakMap<App, HostAdapter>();

/** Cached per-App host (one adapter per Obsidian App instance). */
export function getObsidianHost(app: App): HostAdapter {
  let host = hostCache.get(app);
  if (!host) {
    host = createObsidianHost(app);
    hostCache.set(app, host);
  }
  return host;
}
