import * as React from 'react';
import { createRoot } from 'react-dom/client';
import {
  NativeMermaidView,
  renderMermaidWithNpm,
  type HostAdapter,
} from '@merlay/core';

/**
 * Webview entry (scaffold for Phase 3).
 * Mounts the shared canvas with a minimal host: npm Mermaid engine,
 * console notifications, OS color-scheme theme sync. Document sync
 * (postMessage <-> extension host) lands in Phase 3.
 */
const host: HostAdapter = {
  renderMermaid: renderMermaidWithNpm,
  notify: (message: string) => {
    // eslint-disable-next-line no-console -- webview has no toast channel yet
    console.log(`[Merlay] ${message}`);
  },
  subscribeTheme: (cb: () => void) => {
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (): void => cb();
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  },
};

function postCodeChange(code: string): void {
  const api = (
    window as unknown as { acquireVsCodeApi?: () => { postMessage: (msg: unknown) => void } }
  ).acquireVsCodeApi?.();
  api?.postMessage({ type: 'merlay/codeChange', code });
}

const rootEl = document.getElementById('merlay-root');
if (rootEl) {
  createRoot(rootEl).render(
    <NativeMermaidView
      host={host}
      initialCode={'flowchart LR\n    A["Start"] --> B["Process"]\n    B --> C["End"]'}
      onCodeChange={postCodeChange}
    />
  );
}
