/**
 * postMessage protocol between the extension host and the Merlay webview.
 * Pure types only — no `vscode` import so both sides (and tests) can use this.
 */

export const MERLAY_EDITOR_VIEW_TYPE = 'merlay.mermaidEditor';

export type HostToWebviewMessage =
  | { type: 'merlay/init'; code: string }
  | { type: 'merlay/update'; code: string }
  | { type: 'merlay/theme' };

export type WebviewToHostMessage =
  | { type: 'merlay/ready' }
  | { type: 'merlay/codeChange'; code: string }
  | { type: 'merlay/notify'; message: string };
