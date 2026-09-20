/**
 * Package the VS Code extension and install it into VS Code.
 * Assumes `npm run build:vscode` already ran.
 * Requires the `code` CLI on PATH and network access (vsce via npx).
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const PKG_DIR = new URL('../packages/vscode/', import.meta.url).pathname;

function run(cmd, args, options = {}) {
  execFileSync(cmd, args, { stdio: 'inherit', ...options });
}

for (const file of ['dist/extension.js', 'dist/webview.js', 'dist/webview.css']) {
  if (!fs.existsSync(path.join(PKG_DIR, file))) {
    console.error(`Missing build output: ${file}\nRun "npm run build:vscode" first.`);
    process.exit(1);
  }
}

// Clean stale artifacts so we install exactly what we just packaged.
for (const entry of fs.readdirSync(PKG_DIR)) {
  if (entry.endsWith('.vsix')) fs.rmSync(path.join(PKG_DIR, entry));
}

run('npx', ['-y', '@vscode/vsce', 'package', '--no-dependencies'], { cwd: PKG_DIR });

const vsix = fs.readdirSync(PKG_DIR).find((entry) => entry.endsWith('.vsix'));
if (!vsix) {
  console.error('Packaging produced no .vsix file.');
  process.exit(1);
}

try {
  run('code', ['--install-extension', path.join(PKG_DIR, vsix), '--force']);
} catch {
  console.error(
    'The `code` CLI was not found. Install it (VS Code command palette → "Shell Command: Install \'code\' command in PATH") and re-run.'
  );
  process.exit(1);
}

console.log(`Installed ${vsix} into VS Code.`);
console.log('Reload the VS Code window (Developer: Reload Window) to pick it up.');
