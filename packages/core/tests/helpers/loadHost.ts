import { build } from 'esbuild';
import { createRequire } from 'node:module';

/** Execute real host code with only the unavailable application SDKs replaced. */
export async function loadHost(entry: string, stubs: Record<string, unknown>): Promise<Record<string, unknown>> {
  const result = await build({
    entryPoints: [entry], bundle: true, write: false, platform: 'node',
    format: 'cjs', packages: 'external', logLevel: 'silent',
  });
  const nativeRequire = createRequire(import.meta.url);
  const require = (id: string): unknown => id in stubs ? stubs[id] : nativeRequire(id);
  const module = { exports: {} };
  new Function('require', 'module', 'exports', result.outputFiles[0].text)(require, module, module.exports);
  return module.exports;
}
