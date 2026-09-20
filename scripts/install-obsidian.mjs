/**
 * Install the latest Obsidian build into a vault.
 * Assumes `npm run build:obsidian` already ran.
 *
 * Target vault comes from $MERLAY_VAULT_DIR (see .env.example).
 * The .env file is gitignored — machine paths never enter git.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

function loadDotEnv() {
  const envPath = new URL('../.env', import.meta.url);
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] ??= value;
  }
}

loadDotEnv();

const VAULT_DIR = process.env.MERLAY_VAULT_DIR;
if (!VAULT_DIR) {
  console.error(
    'MERLAY_VAULT_DIR is not set.\nCopy .env.example to .env and point it at your vault.'
  );
  process.exit(1);
}
const PLUGIN_DIR = path.join(VAULT_DIR, '.obsidian', 'plugins', 'merlay');
const PKG_DIR = new URL('../packages/obsidian/', import.meta.url);

for (const file of ['main.js', 'manifest.json', 'styles.css']) {
  const src = new URL(file, PKG_DIR);
  if (!fs.existsSync(src)) {
    console.error(`Missing build output: ${src.pathname}\nRun "npm run build:obsidian" first.`);
    process.exit(1);
  }
}

fs.mkdirSync(PLUGIN_DIR, { recursive: true });
for (const file of ['main.js', 'manifest.json', 'styles.css']) {
  fs.copyFileSync(new URL(file, PKG_DIR), path.join(PLUGIN_DIR, file));
}

console.log(`Installed Merlay into ${PLUGIN_DIR}`);
console.log('Reload Obsidian (Ctrl+R) to pick it up.');
