import * as vscode from 'vscode';

/** HTML shell for the Merlay webview (script + style bundles built by esbuild.mjs). */
export function getWebviewHtml(
  webview: vscode.Webview,
  extensionUri: vscode.Uri
): string {
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'dist', 'webview.js')
  );
  const styleUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'dist', 'webview.css')
  );
  const nonce = String(Date.now());
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} data: blob:; font-src ${webview.cspSource} data:;" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<link rel="stylesheet" href="${styleUri}" />
<!--
  Theme bridge: the shared canvas stylesheet speaks Obsidian variable names
  (--background-primary, --text-normal, --interactive-accent, ...). Map them
  onto VS Code's injected theme variables (--vscode-*) so toolbars, buttons
  and hovers render solid in the active VS Code theme (light and dark).
  Custom properties resolve at use time, so these body-level definitions
  flow into the :root --mermaid-* aliases defined by the shared stylesheet.
-->
<style nonce="${nonce}">body {
  color-scheme: light dark;
  --background-primary: var(--vscode-editor-background);
  --background-secondary: var(--vscode-editorWidget-background, var(--vscode-sideBar-background));
  --background-modifier-border: var(--vscode-widget-border, var(--vscode-panel-border));
  --background-modifier-hover: var(--vscode-list-hoverBackground);
  --background-modifier-active-hover: var(--vscode-list-activeSelectionBackground);
  --background-modifier-error: var(--vscode-inputValidation-errorBackground);
  --text-normal: var(--vscode-editor-foreground);
  --text-muted: var(--vscode-descriptionForeground);
  --text-error: var(--vscode-errorForeground);
  --text-on-accent: var(--vscode-button-foreground);
  --interactive-accent: var(--vscode-button-background);
  --interactive-accent-hover: var(--vscode-button-hoverBackground);
  --shadow-s: var(--vscode-widget-shadow);
  --shadow-m: var(--vscode-widget-shadow);
}</style>
<style nonce="${nonce}">html, body, #merlay-root { height: 100%; margin: 0; padding: 0; overflow: hidden; }</style>
<title>Merlay</title>
</head>
<body>
<div id="merlay-root"></div>
<script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}
