import { mkdir, readdir, rename, rm, stat, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import type { BlobInfo, BlobStore } from '../blobs.js';
import { contentTypeOf } from '../contentType.js';

/**
 * Files on disk, for local development and the test suite.
 *
 * Blob paths are already filesystem-shaped - {repo}/{env}/state/{workflow}/{runId}/
 * {attemptId}.json - so they map onto directories directly. Four things are not
 * inherited from Blob Storage and have to be arranged:
 *
 *  - **Atomic writes.** uploadData on a block blob is a single PUT, so a concurrent
 *    reader sees the old body or the new one. writeFile is not: patchState is a
 *    read-modify-write on one path and SDLB sends one PATCH per action while a run is in
 *    flight, so a torn read would fail JSON.parse and become a 500. Hence temp file plus
 *    rename, which is atomic within a filesystem.
 *  - **Content types.** There is nowhere to record one. Deriving it from the extension is
 *    byte-equivalent for every caller here - see store/contentType.ts - so both sides use
 *    the same map, and a write whose declared type disagrees with its extension is
 *    refused rather than silently stored under a type that cannot be read back.
 *  - **Prefix listing.** listBlobsFlat matches a string prefix, not a directory, so this
 *    walks the prefix's parent and filters. Directories are never reported: Blob Storage
 *    has none, so an empty one has to be invisible.
 *  - **Containment.** blobPaths already refuses a segment that could climb out, but this
 *    is the last line, and the consequence here is writing outside the data directory
 *    rather than a strangely named blob.
 */
export interface FilesystemBlobOptions {
  root: string;
}

/**
 * Temporary files go in one directory rather than beside their target. Same filesystem,
 * so rename stays atomic - but a sibling temp file would be visible to list(), and
 * filtering it out by name would make list() lie about what it can return.
 */
const TEMP_DIR = '.tmp';

export function createFilesystemBlobStore(options: FilesystemBlobOptions): BlobStore {
  const root = path.resolve(options.root);
  const tempRoot = path.join(root, TEMP_DIR);
  const knownDirs = new Set<string>();

  /** Resolve inside the root, or refuse. */
  function resolve(blobPath: string): string {
    const absolute = path.resolve(root, blobPath);
    if (absolute !== root && !absolute.startsWith(root + path.sep)) {
      throw new Error(`Blob path escapes the data directory: ${JSON.stringify(blobPath)}`);
    }
    if (absolute.startsWith(tempRoot + path.sep) || absolute === tempRoot) {
      throw new Error(`Blob path collides with the temporary directory: ${JSON.stringify(blobPath)}`);
    }
    return absolute;
  }

  async function ensureDir(dir: string): Promise<void> {
    if (knownDirs.has(dir)) return;
    await mkdir(dir, { recursive: true });
    knownDirs.add(dir);
  }

  /** Files only, recursively, as paths relative to `dir`. Missing directory means none. */
  async function walk(dir: string, prefix = ''): Promise<string[]> {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch (error) {
      if (isMissing(error)) return [];
      throw error;
    }
    const found: string[] = [];
    for (const entry of entries) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) found.push(...(await walk(path.join(dir, entry.name), relative)));
      else if (entry.isFile()) found.push(relative);
    }
    return found;
  }

  return {
    async writeBuffer(blobPath: string, body: Buffer, contentType: string): Promise<void> {
      const expected = contentTypeOf(blobPath);
      if (contentType !== expected) {
        // Not a silent divergence: on Azure the declared type is stored and wins, here
        // the extension does. No caller does this today, and this is what keeps it so.
        throw new Error(
          `Cannot store ${JSON.stringify(blobPath)} as ${contentType}: this store derives ` +
            `the content type from the extension, which gives ${expected}`,
        );
      }

      const target = resolve(blobPath);
      await ensureDir(path.dirname(target));
      await ensureDir(tempRoot);
      const temp = path.join(tempRoot, randomBytes(16).toString('hex'));
      try {
        await writeFile(temp, body);
        await rename(temp, target);
      } catch (error) {
        await rm(temp, { force: true });
        throw error;
      }
    },

    async readBuffer(blobPath: string): Promise<Buffer | undefined> {
      try {
        return await readFile(resolve(blobPath));
      } catch (error) {
        if (isMissing(error)) return undefined;
        throw error;
      }
    },

    async list(pathPrefix: string): Promise<BlobInfo[]> {
      // A string prefix, not a directory: split at the last slash, walk that directory,
      // and keep whatever still starts with the whole prefix.
      const cut = pathPrefix.lastIndexOf('/');
      const dir = cut < 0 ? '' : pathPrefix.slice(0, cut);
      const base = resolve(dir);

      const results: BlobInfo[] = [];
      for (const relative of await walk(base)) {
        const full = dir ? `${dir}/${relative}` : relative;
        if (!full.startsWith(pathPrefix)) continue;
        const info = await stat(path.join(base, relative));
        results.push({
          name: full.slice(pathPrefix.length),
          contentType: contentTypeOf(full),
          size: info.size,
          lastModified: info.mtime,
        });
      }
      return results;
    },

    async remove(blobPath: string): Promise<boolean> {
      const target = resolve(blobPath);
      try {
        await rm(target);
        // Emptied directories are left alone: pruning races a concurrent write into the
        // same directory, and walk() reports only files, so an empty one is already
        // invisible - which is what Blob Storage looks like.
        return true;
      } catch (error) {
        if (isMissing(error)) return false;
        throw error;
      }
    },
  };
}

function isMissing(error: unknown): boolean {
  return (error as { code?: string })?.code === 'ENOENT';
}
