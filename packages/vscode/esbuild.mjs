import esbuild from 'esbuild';
import process from 'process';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { sharedOptions } from '../../esbuild.shared.mjs';

// Runs with cwd = packages/vscode (npm -w). Resolve from here.
const here = dirname(fileURLToPath(import.meta.url));

const prod = process.argv[2] === 'production';

// 1. Extension host (Node): `vscode` is provided by the runtime.
const host = await esbuild.context({
  ...sharedOptions,
  entryPoints: [join(here, 'src/extension.ts')],
  external: ['vscode'],
  format: 'cjs',
  platform: 'node',
  sourcemap: prod ? false : 'inline',
  outfile: join(here, 'dist/extension.js'),
  minify: prod,
});

// 2. Webview (browser sandbox): everything bundled, single IIFE file.
// The shared canvas stylesheet ships alongside as webview.css.
const webview = await esbuild.context({
  ...sharedOptions,
  entryPoints: [join(here, 'src/webview.tsx')],
  format: 'iife',
  platform: 'browser',
  sourcemap: prod ? false : 'inline',
  outfile: join(here, 'dist/webview.js'),
  minify: prod,
  plugins: [
    {
      name: 'copy-core-css',
      setup(build) {
        build.onEnd(() => {
          const src = join(here, '..', 'core', 'src', 'styles.css');
          if (fs.existsSync(src)) {
            fs.mkdirSync(join(here, 'dist'), { recursive: true });
            fs.copyFileSync(src, join(here, 'dist', 'webview.css'));
          }
        });
      },
    },
  ],
});

if (prod) {
  await host.rebuild();
  await webview.rebuild();
  process.exit(0);
} else {
  await host.watch();
  await webview.watch();
}
