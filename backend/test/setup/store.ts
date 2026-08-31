import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { resetSettings } from '../../src/config.js';
import { resetStore } from '../../src/store/repositories.js';
import { resetBlobStore } from '../../src/store/blobs.js';
import { clearConfigCache } from '../../src/services/config.js';

/**
 * A store of its own for one test file.
 *
 * The suites used to share one Azurite account, and every one of them seeded the same
 * getting-started/dev scope into it. That, rather than Azurite itself, is why
 * vitest.config.ts had fileParallelism off: two files seeding at once would let one read
 * a half-written index, since the workflow counts are a recount over what is stored. A
 * directory per file removes the shared state, so the files can run at the same time
 * again - and there is no emulator to start.
 *
 * Vitest isolates the module registry per file, so the memoised settings and store are
 * already per file; these resets are for the environment this changes underneath them.
 */
export async function useTempStore(): Promise<{ dir: string; cleanup: () => Promise<void> }> {
  const dir = await mkdtemp(path.join(tmpdir(), 'sdlb-store-'));

  process.env.SDLB_STORAGE_BACKEND = 'local';
  process.env.SDLB_SQLITE_FILE = path.join(dir, 'entities.db');
  process.env.SDLB_BLOB_ROOT = path.join(dir, 'blobs');
  process.env.SDLB_AUTH_MODE ??= 'disabled';
  process.env.SDLB_LOG_LEVEL ??= 'error';
  reset();

  return {
    dir,
    cleanup: async () => {
      reset();
      await rm(dir, { recursive: true, force: true, maxRetries: 3 });
    },
  };
}

function reset(): void {
  resetSettings();
  resetStore();
  resetBlobStore();
  clearConfigCache();
}
