import { settings } from '../config.js';
import { assertPathNumber, assertPathSegment } from './limits.js';
import type { Scope } from './types.js';

/**
 * Where every file and every large payload lives: state files, exported
 * configurations, description markdown and its images, schemas and statistics. The
 * entity store only indexes what has to be queried.
 *
 * The surface is deliberately small - whole-buffer reads and writes, a prefix listing,
 * a delete. No streaming, no SAS, no conditional requests, no metadata: nothing here
 * needs them, and every one of them would be another thing a second driver had to
 * reproduce.
 */

export interface BlobInfo {
  /** Path relative to the prefix it was listed under. */
  name: string;
  contentType: string;
  size: number;
  lastModified: Date;
}

export interface BlobStore {
  writeBuffer(path: string, body: Buffer, contentType: string): Promise<void>;
  readBuffer(path: string): Promise<Buffer | undefined>;
  /**
   * Everything under a prefix, with `name` relative to it.
   *
   * A *string* prefix, not a path prefix - "a/b/pre" matches "a/b/prefix.md". The only
   * caller passes a slash-terminated prefix, so a driver that treated it as a directory
   * would work today and be wrong later.
   */
  list(pathPrefix: string): Promise<BlobInfo[]>;
  /** True if it existed. */
  remove(path: string): Promise<boolean>;
}

const prefix = (scope: Scope) =>
  `${assertPathSegment(scope.repo, 'repo')}/${assertPathSegment(scope.env, 'env')}`;

/**
 * Every free-form segment goes through assertPathSegment, so no caller can build a
 * path that climbs out of its prefix - see the comment on that function for why the
 * guard lives here rather than in the services.
 */
export const blobPaths = {
  state: (scope: Scope, workflow: string, runId: number, attemptId: number) =>
    `${prefix(scope)}/state/${assertPathSegment(workflow, 'workflow')}` +
    `/${assertPathNumber(runId, 'runId')}/${assertPathNumber(attemptId, 'attemptId')}.json`,
  config: (scope: Scope, version: string) =>
    `${prefix(scope)}/config/${assertPathSegment(version, 'version')}/exportedConfig.json`,
  /** `filename` is the API's path segment verbatim, slashes and all - assertSafeFilename guards it. */
  description: (scope: Scope, version: string, filename: string) =>
    `${prefix(scope)}/descriptions/${assertPathSegment(version, 'version')}/${filename}`,
  descriptionsPrefix: (scope: Scope, version: string) =>
    `${prefix(scope)}/descriptions/${assertPathSegment(version, 'version')}/`,
  schema: (scope: Scope, dataObjectId: string, tstamp: number) =>
    `${prefix(scope)}/schema/${assertPathSegment(dataObjectId, 'dataObjectId')}` +
    `/${assertPathNumber(tstamp, 'tstamp')}.json`,
  stats: (scope: Scope, dataObjectId: string, tstamp: number) =>
    `${prefix(scope)}/stats/${assertPathSegment(dataObjectId, 'dataObjectId')}` +
    `/${assertPathNumber(tstamp, 'tstamp')}.json`,
};

export async function writeJson(path: string, value: unknown): Promise<void> {
  await writeBuffer(path, Buffer.from(JSON.stringify(value), 'utf8'), 'application/json');
}

export async function readJson<T>(path: string): Promise<T | undefined> {
  const buffer = await readBuffer(path);
  return buffer === undefined ? undefined : (JSON.parse(buffer.toString('utf8')) as T);
}

export async function writeBuffer(
  path: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  return (await blobStore()).writeBuffer(path, body, contentType);
}

export async function readBuffer(path: string): Promise<Buffer | undefined> {
  return (await blobStore()).readBuffer(path);
}

export async function list(pathPrefix: string): Promise<BlobInfo[]> {
  return (await blobStore()).list(pathPrefix);
}

export async function remove(path: string): Promise<boolean> {
  return (await blobStore()).remove(path);
}

let resolved: Promise<BlobStore> | undefined;

/**
 * The blob store this deployment is configured for. Dynamically imported for the same
 * reason as the entity driver, with a literal specifier for the same reason - see
 * store/repositories.ts.
 */
export function blobStore(): Promise<BlobStore> {
  if (!resolved) resolved = build();
  return resolved;
}

/** Only for tests, which point successive cases at different stores. */
export function resetBlobStore(): void {
  resolved = undefined;
}

async function build(): Promise<BlobStore> {
  const config = settings().blobStore;
  switch (config.kind) {
    case 'azureBlob': {
      const { createAzureBlobStore } = await import('./drivers/azureBlob.js');
      return createAzureBlobStore({ storage: config.auth, container: config.container });
    }
    case 'filesystem': {
      const { createFilesystemBlobStore } = await import('./drivers/filesystem.js');
      return createFilesystemBlobStore({ root: config.root });
    }
  }
}
