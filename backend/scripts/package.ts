import { execFile } from 'node:child_process';
import { cp, mkdir, readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { bundle } from './bundle.js';

/**
 * Assemble what actually gets uploaded to the Azure Function app.
 *
 * `yarn build` produces `dist/`; this produces the *package*, which is a different
 * thing and more than a copy. The Functions host wants a directory whose root holds
 * `host.json`, `package.json` and the runnable JavaScript, with `node_modules` beside
 * them - and cold start is charged per instance for every byte of it, so what goes in
 * is only what runs:
 *
 *  - **`host.json` and `package.json` at the root.** That is where the host looks for
 *    its configuration and for the `main` field naming the entry point. Not `src/`,
 *    not `tsconfig.json`, none of the tests.
 *  - **A production-only install**, done inside the staging directory rather than
 *    copied from the working tree. The bundle inlines every dependency except
 *    `@azure/functions`, so `--production` resolves to that one package and whatever
 *    it needs - about 1.3 MB, against 105 MB of dev `node_modules`. See "What gets
 *    deployed, and cold start" in ../README.md.
 *
 * It is deliberately independent of how the package is then shipped: this knows the
 * layout, `infra_azure/deploy-backend.sh` knows Azure, and
 * `.github/workflows/build.yml` publishes the result as an artifact. All three get the
 * same package because only this file decides what is in one.
 */

const BACKEND_DIR = path.resolve(fileURLToPath(import.meta.url), '../..');

/** Copied to the root of the package. yarn.lock only so the install is reproducible. */
const ROOT_FILES = ['host.json', 'package.json', 'yarn.lock'];

/**
 * Removed once the install has read them. Neither is read at runtime, and
 * `.yarn-integrity` being a dotfile is the one thing that would make the CI artifact -
 * which actions/upload-artifact builds without hidden files - a different set of files
 * from a package assembled here.
 */
const INSTALL_LEFTOVERS = ['yarn.lock', 'node_modules/.yarn-integrity'];

/**
 * A package missing any of these uploads successfully and then registers no routes, or
 * answers 500 to everything - both of which look like an infrastructure problem from
 * the outside. Much cheaper to find out here.
 */
const REQUIRED = [
  'host.json',
  'package.json',
  'dist/http.js',
  'node_modules/@azure/functions/package.json',
];

const exec = promisify(execFile);

export interface PackageOptions {
  /** Where to assemble it. Emptied first, so it must be a directory to own. */
  outdir: string;
  /** Run the bundle first. Default true; false uses whatever is in `dist/` already. */
  build?: boolean;
  logLevel?: 'info' | 'silent';
}

export interface PackageResult {
  outdir: string;
  files: number;
  bytes: number;
}

export async function packageApp(options: PackageOptions): Promise<PackageResult> {
  const outdir = path.resolve(options.outdir);
  const log = options.logLevel === 'silent' ? () => {} : (line: string) => console.log(line);

  // bundle() and the yarn install both resolve against the working directory, and this
  // is invoked from a deploy script as readily as from `yarn package`.
  process.chdir(BACKEND_DIR);

  if (options.build ?? true) {
    await bundle({ logLevel: options.logLevel ?? 'info' });
  }

  // Checked rather than assumed: --no-build against an empty dist/ would otherwise
  // produce a package that looks fine and serves nothing.
  await stat(path.join(BACKEND_DIR, 'dist/http.js')).catch(() => {
    throw new Error(
      'there is no build in dist/. Run `yarn build`, or drop --no-build so this builds it.',
    );
  });

  // Emptied, not merged into: a chunk name is content-hashed, so leftovers from an
  // earlier build would ship alongside the current ones.
  await rm(outdir, { recursive: true, force: true });
  await mkdir(outdir, { recursive: true });

  for (const file of ROOT_FILES) {
    await cp(path.join(BACKEND_DIR, file), path.join(outdir, file));
  }
  await cp(path.join(BACKEND_DIR, 'dist'), path.join(outdir, 'dist'), { recursive: true });

  // --ignore-scripts because nothing in this tree has an install script worth running,
  // and a package that gains one should not get to run it on a deploy.
  await exec('yarn', ['install', '--production', '--frozen-lockfile', '--ignore-scripts', '--non-interactive'], {
    cwd: outdir,
    // yarn prints engine warnings for devDependencies it is not installing.
    env: { ...process.env, npm_config_loglevel: 'error' },
  });

  for (const leftover of INSTALL_LEFTOVERS) {
    await rm(path.join(outdir, leftover), { recursive: true, force: true });
  }

  for (const required of REQUIRED) {
    await stat(path.join(outdir, required)).catch(() => {
      throw new Error(`the assembled package has no ${required} - it is not deployable.`);
    });
  }

  const { files, bytes } = await measure(outdir);
  log(`${'package'.padEnd(40)} ${outdir}`);
  log(`${'total'.padEnd(40)} ${(bytes / 1024).toFixed(0)} kB in ${files} files`);
  return { outdir, files, bytes };
}

async function measure(dir: string): Promise<{ files: number; bytes: number }> {
  let files = 0;
  let bytes = 0;
  for (const entry of await readdir(dir, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile()) continue;
    files += 1;
    bytes += (await stat(path.join(entry.parentPath, entry.name))).size;
  }
  return { files, bytes };
}

// Only when run directly, not when a test or a deploy script imports it.
if (process.argv[1]?.endsWith('package.ts')) {
  const argv = process.argv.slice(2);
  let outdir = path.join(BACKEND_DIR, 'dist-package');
  let build = true;

  for (let i = 0; i < argv.length; i += 1) {
    switch (argv[i]) {
      case '--out':
        outdir = argv[++i] ?? '';
        if (!outdir) throw new Error('--out needs a value.');
        break;
      case '--no-build':
        build = false;
        break;
      case '-h':
      case '--help':
        console.log(`Assemble the deployable Azure Functions package.

  yarn package                     build, then assemble into dist-package/
  yarn package --out DIR           assemble into DIR instead (emptied first)
  yarn package --no-build          use the existing dist/ rather than rebuilding

infra_azure/deploy-backend.sh uploads what this produces; build.yml publishes it as
the sdl-visualizer-backend artifact.`);
        process.exit(0);
      default:
        throw new Error(`unknown argument: ${argv[i]}`);
    }
  }

  await packageApp({ outdir, build });
}
