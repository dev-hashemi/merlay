import * as React from 'react';
import { createRoot } from 'react-dom/client';
import {
  NativeMermaidView,
  renderMermaidWithNpm,
  type HostAdapter,
} from '@merlay/core';
import type { HostToWebviewMessage, WebviewToHostMessage } from './protocol';

interface VsCodeApi {
  postMessage: (message: WebviewToHostMessage) => void;
}

function getVsCodeApi(): VsCodeApi | null {
  try {
    const w = window as unknown as {
      acquireVsCodeApi?: () => VsCodeApi;
    };
    return w.acquireVsCodeApi?.() ?? null;
  } catch {
    return null;
  }
}

const FALLBACK_CODE = 'flowchart LR\n    A["Start"] --> B["Process"]\n    B --> C["End"]';

function MerlayWebviewApp(): React.ReactElement {
  const apiRef = React.useRef<VsCodeApi | null>(null);
  if (apiRef.current === null) {
    apiRef.current = getVsCodeApi();
  }
  // Outside VS Code (plain browser preview) show the fallback immediately.
  const [docCode, setDocCode] = React.useState<string | null>(() =>
    apiRef.current ? null : FALLBACK_CODE
  );
  const themeSubsRef = React.useRef(new Set<() => void>());

  const host = React.useMemo<HostAdapter>(
    () => ({
      renderMermaid: renderMermaidWithNpm,
      notify: (message: string) => {
        apiRef.current?.postMessage({ type: 'merlay/notify', message });
      },
      subscribeTheme: (cb: () => void) => {
        themeSubsRef.current.add(cb);
        return () => {
          themeSubsRef.current.delete(cb);
        };
      },
    }),
    []
  );

  React.useEffect(() => {
    const api = apiRef.current;
    if (!api) return;
    const onMessage = (event: MessageEvent): void => {
      const message = event.data as HostToWebviewMessage;
      if (message.type === 'merlay/init' || message.type === 'merlay/update') {
        // Echo guard: identical code is a no-op (React bails out, canvas keeps history).
        setDocCode((prev) => (prev === message.code ? prev : message.code));
      } else if (message.type === 'merlay/theme') {
        themeSubsRef.current.forEach((cb) => cb());
      }
    };
    window.addEventListener('message', onMessage);
    api.postMessage({ type: 'merlay/ready' });
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const handleCodeChange = React.useCallback((code: string) => {
    apiRef.current?.postMessage({ type: 'merlay/codeChange', code });
  }, []);

  if (docCode === null) {
    return <div className="merlay-webview-loading">Loading diagram…</div>;
  }
  return (
    <NativeMermaidView host={host} initialCode={docCode} onCodeChange={handleCodeChange} />
  );
}

const rootEl = document.getElementById('merlay-root');
if (rootEl) {
  createRoot(rootEl).render(<MerlayWebviewApp />);
}
