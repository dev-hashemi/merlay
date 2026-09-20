import esbuild from 'esbuild';
import process from 'process';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { sharedOptions, obsidianExternals, banner } from '../../esbuild.shared.mjs';

// Runs with cwd = packages/obsidian (npm -w). Resolve everything from here
// so the config also works when invoked directly from this directory.
const here = dirname(fileURLToPath(import.meta.url));

const prod = process.argv[2] === 'production';

const context = await esbuild.context({
  ...sharedOptions,
  banner: {
    js: banner,
  },
  entryPoints: [join(here, 'src/main.ts')],
  external: obsidianExternals,
  format: 'cjs',
  sourcemap: prod ? false : 'inline',
  outfile: join(here, 'main.js'),
  minify: prod,
  plugins: [
    {
      name: 'copy-css',
      setup(build) {
        build.onEnd(() => {
          // Canvas stylesheet is owned by @merlay/core; copy it next to
          // the bundle so Obsidian loads it as the plugin stylesheet.
          const src = join(here, '..', 'core', 'src', 'styles.css');
          if (fs.existsSync(src)) {
            fs.copyFileSync(src, join(here, 'styles.css'));
          }
        });
      },
    },
  ],
});

if (prod) {
  await context.rebuild();
  process.exit(0);
} else {
  await context.watch();
}
