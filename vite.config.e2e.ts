import fs from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, mergeConfig, type Plugin, type UserConfig } from 'vite';
import baseConfig from './vite.config';

/**
 * Vite config used by the Playwright end-to-end tests.
 *
 * It is the normal dev config plus a middleware that serves the test fixtures
 * (config, state files, schemas, descriptions and manifest.json) instead of
 * whatever the developer happens to have in public/. public/config and
 * public/state are gitignored local data, so tests must not depend on them.
 *
 * The fixture variant is selected with E2E_FIXTURE:
 *   hocon    - config is parsed from HOCON files (HoconParser + envConfig/dev.conf)
 *   exported - config is read from exportedConfig.json, as the deployed
 *              getting-started visualizer does
 * Both variants share the same state files, schemas and descriptions.
 *
 * The fixtures are served by the dev server and by `vite preview` alike: `yarn test:e2e`
 * builds the app once into build-e2e/ and previews it per variant, as a production build
 * loads much faster than a dev server compiling every module on first request.
 */

const rootDir = fileURLToPath(new URL('.', import.meta.url));
const fixturesDir = path.join(rootDir, 'tests', 'e2e', 'fixtures');

// everything the fetchAPI_local_statefiles backend asks for
const fixturePrefixes = [
  '/manifest.json',
  '/exportedConfig.json',
  '/config',
  '/envConfig',
  '/state',
  '/schema',
  '/description',
  '/search',
];

const contentTypes: Record<string, string> = {
  '.json': 'application/json',
  '.conf': 'text/plain',
  '.md': 'text/markdown',
  '.png': 'image/png',
};

function fixtureBackend(variant: string): Plugin {
  // first match wins, so a variant can shadow a shared file
  const roots = [path.join(fixturesDir, variant), path.join(fixturesDir, 'shared')];
  roots.forEach((root) => {
    if (!fs.existsSync(root)) throw new Error(`E2E fixture directory does not exist: ${root}`);
  });

  const serveFixtures = (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const urlPath = decodeURIComponent((req.url ?? '').split('?')[0]);
    if (!fixturePrefixes.some((p) => urlPath === p || urlPath.startsWith(p + '/'))) return next();

    for (const root of roots) {
      const file = path.join(root, urlPath);
      // don't let a crafted url escape the fixture directory
      if (!file.startsWith(root + path.sep)) break;
      if (fs.existsSync(file) && fs.statSync(file).isFile()) {
        res.setHeader('Content-Type', contentTypes[path.extname(file)] ?? 'text/plain');
        res.end(fs.readFileSync(file));
        return;
      }
    }

    // Answer with 404 rather than falling through to vite's index.html
    // fallback: the app's fallbacks (e.g. directory listing -> config/index)
    // key on the response not being ok.
    res.statusCode = 404;
    res.end(`no e2e fixture for ${urlPath}`);
  };

  return {
    name: 'e2e-fixture-backend',
    // both hooks run before vite's internal static/spa-fallback middlewares,
    // so fixtures take precedence over public/
    configureServer(server) {
      server.middlewares.use(serveFixtures);
    },
    configurePreviewServer(server) {
      server.middlewares.use(serveFixtures);
    },
  };
}

export default defineConfig(async (env) => {
  const variant = process.env.E2E_FIXTURE ?? 'hocon';
  const base = (await baseConfig(env)) as UserConfig;
  return mergeConfig(base, {
    // separate cache per variant, the two dev servers start in parallel
    cacheDir: `node_modules/.vite-e2e-${variant}`,
    plugins: [fixtureBackend(variant)],
    server: { strictPort: true },
    preview: { strictPort: true },
    // one build for all variants: the fixtures only change what the server answers. CI previews
    // the production build it has made anyway (E2E_OUTDIR=build), as the bundle is the same
    build: { outDir: process.env.E2E_OUTDIR ?? 'build-e2e' },
  } satisfies UserConfig);
});
