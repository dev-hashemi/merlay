import * as vscode from 'vscode';

/** HTML shell for the Merlay webview (script bundle built by esbuild.mjs). */
export function getWebviewHtml(
  webview: vscode.Webview,
  extensionUri: vscode.Uri
): string {
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'dist', 'webview.js')
  );
  const nonce = String(Date.now());
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} data: blob:; font-src ${webview.cspSource} data:;" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Merlay</title>
</head>
<body>
<div id="merlay-root"></div>
<script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}
