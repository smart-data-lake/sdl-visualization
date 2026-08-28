import { rm } from 'node:fs/promises';
import { build, type BuildOptions, type Metafile } from 'esbuild';

/**
 * Bundle the app into what actually gets deployed.
 *
 * `tsc` alone emits per-file JavaScript and leaves the whole dependency tree to be
 * shipped and resolved at runtime - about 105 MB of node_modules, 60 MB of which is
 * source maps nothing reads. Every one of those files is a stat and a read on a cold
 * start.
 *
 * Two things are deliberate:
 *
 *  - **`@azure/functions` stays external.** The Functions host provides
 *    `@azure/functions-core` to the worker at runtime; it is not a package that can
 *    be resolved at build time, and bundling the library that reaches for it breaks
 *    function registration. It stays a real dependency in node_modules.
 *  - **Code splitting is on.** `functions/http.ts` imports the MCP handler lazily so
 *    an SDLB upload does not pay to load the MCP SDK, zod and the tools. Without
 *    splitting, esbuild would inline that dynamic import into the one file and the
 *    parse cost would come back.
 *  - **The output is ESM, so `require` has to be put back.** Plenty of the bundled
 *    dependencies are CommonJS and reach for Node built-ins with `require('net')`
 *    and friends. In an ES module that identifier does not exist, and esbuild's shim
 *    throws "Dynamic require of ... is not supported" at runtime rather than at
 *    build time - so nothing catches it until the first request. The banner defines
 *    the CommonJS trio in every chunk; esbuild's shim picks the real `require` up.
 */

const CJS_BANNER = [
  "import { createRequire as __sdlbCreateRequire } from 'node:module';",
  "import { fileURLToPath as __sdlbFileURLToPath } from 'node:url';",
  "import { dirname as __sdlbDirname } from 'node:path';",
  'const require = __sdlbCreateRequire(import.meta.url);',
  'const __filename = __sdlbFileURLToPath(import.meta.url);',
  'const __dirname = __sdlbDirname(__filename);',
].join('\n');

export const EXTERNAL = ['@azure/functions', '@azure/functions-core'];

export interface BundleOptions {
  outdir?: string;
  minify?: boolean;
  sourcemap?: BuildOptions['sourcemap'];
  keepNames?: boolean;
  logLevel?: BuildOptions['logLevel'];
}

export async function bundle(options: BundleOptions = {}): Promise<{ metafile: Metafile }> {
  const outdir = options.outdir ?? 'dist';
  // Chunk names are content-hashed, so a stale build leaves orphans behind - and a
  // stale entry point can outlive the chunk it imports.
  await rm(outdir, { recursive: true, force: true });

  const result = await build({
    entryPoints: ['src/functions/http.ts'],
    outdir,
    bundle: true,
    splitting: true,
    format: 'esm',
    platform: 'node',
    // Matches runtime_version in infra/ and .nvmrc.
    target: 'node24',
    minify: options.minify ?? true,
    // Names survive minification, so an Application Insights stack trace still says
    // which function threw. Cheap, and it is the only thing standing in for the
    // source maps that are left out by default - see below.
    keepNames: options.keepNames ?? true,
    // Maps are four times the size of the code they describe, and Node does not
    // read them unless --enable-source-maps is set. That is a poor trade for a
    // package every cold-starting instance downloads. SDLB_SOURCEMAP=1 to get them.
    sourcemap: options.sourcemap ?? (process.env.SDLB_SOURCEMAP === '1' ? 'linked' : false),
    treeShaking: true,
    external: EXTERNAL,
    banner: { js: CJS_BANNER },
    logLevel: options.logLevel ?? 'silent',
    metafile: true,
  });
  return { metafile: result.metafile };
}

// Only when run directly, not when the bundle test imports it.
if (process.argv[1]?.endsWith('bundle.ts')) {
  const { metafile } = await bundle({ logLevel: 'info' });
  const outputs = Object.entries(metafile.outputs)
    .filter(([file]) => file.endsWith('.js'))
    .sort((a, b) => b[1].bytes - a[1].bytes);
  let total = 0;
  for (const [file, meta] of outputs) {
    total += meta.bytes;
    console.log(`${file.padEnd(40)} ${(meta.bytes / 1024).toFixed(0)} kB`);
  }
  console.log(`${'total JavaScript'.padEnd(40)} ${(total / 1024).toFixed(0)} kB`);
}
