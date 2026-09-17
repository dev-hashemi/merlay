import test from 'node:test';
import assert from 'node:assert';
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const SRC = join(ROOT, 'src');

function collectTsFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === 'node_modules') continue;
      collectTsFiles(full, out);
    } else if (/\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

function srcFiles(): { path: string; rel: string; code: string }[] {
  return collectTsFiles(SRC).map((path) => ({
    path,
    rel: relative(ROOT, path),
    code: readFileSync(path, 'utf8'),
  }));
}

function assertNoMatch(
  files: { rel: string; code: string }[],
  pattern: RegExp,
  message: string,
  allowlist: string[] = []
): void {
  const hits: string[] = [];
  for (const f of files) {
    // Strip line comments to avoid flagging rule explanations.
    const stripped = f.code
      .split('\n')
      .filter((line) => !line.trim().startsWith('*') && !line.trim().startsWith('//'))
      .join('\n');
    pattern.lastIndex = 0;
    if (pattern.test(stripped) && !allowlist.includes(f.rel)) {
      hits.push(f.rel);
    }
  }
  assert.deepStrictEqual(hits, [], `${message}: ${hits.join(', ')}`);
}

// --- Manifest + release checklist (review-blocking) ---

test('Obsidian compliance: manifest has all required fields', () => {
  const manifest = JSON.parse(readFileSync(join(ROOT, 'manifest.json'), 'utf8')) as Record<
    string,
    unknown
  >;
  for (const field of [
    'id',
    'name',
    'version',
    'minAppVersion',
    'description',
    'author',
    'isDesktopOnly',
  ]) {
    assert.ok(manifest[field] !== undefined, `manifest.json missing "${field}"`);
  }
  assert.match(String(manifest.version), /^\d+\.\d+\.\d+$/, 'version must be x.y.z');
  assert.ok(!String(manifest.id).includes('obsidian'), 'id must not contain "obsidian"');
  assert.match(String(manifest.id), /^[a-z0-9-]+$/, 'id must be lowercase letters/hyphens');
});

test('Obsidian compliance: manifest version matches package.json and versions.json', () => {
  const manifest = JSON.parse(readFileSync(join(ROOT, 'manifest.json'), 'utf8')) as {
    version: string;
  };
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
    version: string;
  };
  const versions = JSON.parse(readFileSync(join(ROOT, 'versions.json'), 'utf8')) as Record<
    string,
    string
  >;
  assert.strictEqual(
    pkg.version,
    manifest.version,
    'package.json version must equal manifest.json version'
  );
  assert.ok(
    versions[manifest.version] !== undefined,
    `versions.json must contain "${manifest.version}" (release checklist)`
  );
});

test('Obsidian compliance: README and LICENSE exist at repo root', () => {
  assert.ok(existsSync(join(ROOT, 'README.md')), 'README.md required for community directory');
  assert.ok(existsSync(join(ROOT, 'LICENSE')), 'LICENSE required for community directory');
});

// --- API misuse guards (statically checkable) ---

test('Obsidian compliance: no direct workspace.activeLeaf access', () => {
  assertNoMatch(srcFiles(), /\.activeLeaf\b/, 'use getActiveViewOfType/activeEditor instead');
});

test('Obsidian compliance: no stashed custom view references', () => {
  assertNoMatch(srcFiles(), /this\.view\s*=/, 'look views up via getActiveLeavesOfType()');
});

test('Obsidian compliance: prefer Vault API over Adapter / full scans', () => {
  assertNoMatch(
    srcFiles(),
    /vault\.adapter\b/,
    'use the Vault API instead of vault.adapter'
  );
  assertNoMatch(
    srcFiles(),
    /\.getFiles\(\)\s*\.find\(/,
    'use getFileByPath/getAbstractFileByPath instead of getFiles().find()'
  );
});

test('Obsidian compliance: commands use narrowest callback and no default hotkeys', () => {
  const files = srcFiles();
  assertNoMatch(files, /\bhotkeys?\s*:/, 'commands must not set default hotkeys');
  const hits: string[] = [];
  for (const f of files) {
    const re = /\.addCommand\(\{/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(f.code)) !== null) {
      const block = f.code.slice(m.index, m.index + 800);
      if (!/(callback|checkCallback|editorCallback|editorCheckCallback)\s*:/.test(block)) {
        hits.push(f.rel);
      }
    }
  }
  assert.deepStrictEqual(hits, [], `addCommand without a callback type: ${hits.join(', ')}`);
});

// --- Security / mobile guards ---

test('Obsidian compliance: no Node/Electron imports (isDesktopOnly is false)', () => {
  assertNoMatch(
    srcFiles(),
    /(from\s+['"](node:|fs['"]|crypto['"]|os['"]|electron['"]|child_process|path['"])|require\(\s*['"](fs|crypto|os|electron|child_process)['"])/,
    'mobile-safe Web APIs only (SubtleCrypto, navigator.clipboard)'
  );
});

test('Obsidian compliance: no innerHTML/outerHTML setters in code', () => {
  assertNoMatch(
    srcFiles(),
    /\.(innerHTML|outerHTML)\s*=/,
    'use DOMParser / createEl / createDiv instead of innerHTML'
  );
  assertNoMatch(
    srcFiles(),
    /\.insertAdjacentHTML\s*\(/,
    'use DOMParser / createEl / createDiv instead of insertAdjacentHTML'
  );
});

test('Obsidian compliance: no static style assignments (obsidianmd/no-static-styles-assignment)', () => {
  assertNoMatch(
    srcFiles(),
    /\.style\.[a-zA-Z]+\s*=\s*['"][^'"]*['"]/,
    'use CSS classes or dynamic variables instead of static style assignments'
  );
  assertNoMatch(
    srcFiles(),
    /\.style(?:\??\.)?setProperty\(\s*['"][^'"]+['"]\s*,\s*['"][^'"]*['"]\s*\)/,
    'use CSS classes or dynamic variables instead of static setProperty calls'
  );
  assertNoMatch(
    srcFiles(),
    /\.setAttribute\(\s*['"]style['"]\s*,\s*['"][^'"]*['"]\s*\)/,
    'use CSS classes or dynamic variables instead of setAttribute("style", ...)'
  );
});

test('Obsidian compliance: no undescribed directive comments (eslint-comments/require-description)', () => {
  const files = srcFiles();
  const hits: string[] = [];
  for (const f of files) {
    const lines = f.code.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/\/\/\s*eslint-disable(?:-next-line|-line)?(?:\s|$)/.test(line)) {
        if (!line.includes('--')) {
          hits.push(`${f.rel}:${i + 1}`);
        }
      }
    }
  }
  assert.deepStrictEqual(hits, [], `undescribed eslint directive comments: ${hits.join(', ')}`);
});

test('Obsidian compliance: no hardcoded text colors in TS', () => {
  assertNoMatch(
    srcFiles(),
    /\.style\.color\s*=/,
    'use CSS classes + Obsidian CSS vars so themes can override'
  );
});

test('Obsidian compliance: no telemetry / analytics identifiers', () => {
  assertNoMatch(srcFiles(), /\b(telemetry|analytics|trackingPixel)\b/i, 'no telemetry allowed');
});
