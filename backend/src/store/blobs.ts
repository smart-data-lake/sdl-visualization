import { BlobServiceClient, ContainerClient } from '@azure/storage-blob';
import { settings } from '../config.js';
import { blobEndpoint, storageCredential } from './credential.js';
import { assertPathNumber, assertPathSegment } from './limits.js';
import type { Scope } from './types.js';

/**
 * Blob Storage is the source of truth for every file and every large payload:
 * state files, exported configs, description markdown and its images, schemas
 * and statistics. Tables only index what has to be queried.
 */

let _container: Promise<ContainerClient> | undefined;

export function container(): Promise<ContainerClient> {
  if (!_container) _container = buildContainer();
  return _container;
}

async function buildContainer(): Promise<ContainerClient> {
  const storage = settings().storage;
  const service =
    storage.kind === 'identity'
      ? new BlobServiceClient(blobEndpoint(storage.accountName), await storageCredential(), {
          retryOptions: { maxTries: 3 },
        })
      // No allowInsecureConnection here, unlike the table client: @azure/storage-blob
      // builds its own pipeline with no https guard and takes the scheme from the
      // connection string's BlobEndpoint, so Azurite's http works as-is.
      : BlobServiceClient.fromConnectionString(storage.value, { retryOptions: { maxTries: 3 } });

  const client = service.getContainerClient(settings().blobContainer);
  await client.createIfNotExists();
  return client;
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
  const body = Buffer.from(JSON.stringify(value), 'utf8');
  await writeBuffer(path, body, 'application/json');
}

export async function writeBuffer(
  path: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  const client = (await container()).getBlockBlobClient(path);
  await client.uploadData(body, { blobHTTPHeaders: { blobContentType: contentType } });
}

export async function readJson<T>(path: string): Promise<T | undefined> {
  const buffer = await readBuffer(path);
  return buffer === undefined ? undefined : (JSON.parse(buffer.toString('utf8')) as T);
}

export async function readBuffer(path: string): Promise<Buffer | undefined> {
  const client = (await container()).getBlockBlobClient(path);
  try {
    return await client.downloadToBuffer();
  } catch (error) {
    if (isNotFound(error)) return undefined;
    throw error;
  }
}

export interface BlobInfo {
  /** Path relative to the prefix it was listed under. */
  name: string;
  contentType: string;
  size: number;
  lastModified: Date;
}

export async function list(pathPrefix: string): Promise<BlobInfo[]> {
  const client = await container();
  const results: BlobInfo[] = [];
  for await (const blob of client.listBlobsFlat({ prefix: pathPrefix })) {
    results.push({
      name: blob.name.slice(pathPrefix.length),
      contentType: blob.properties.contentType ?? 'application/octet-stream',
      size: blob.properties.contentLength ?? 0,
      lastModified: blob.properties.lastModified ?? new Date(0),
    });
  }
  return results;
}

export async function remove(path: string): Promise<boolean> {
  const client = (await container()).getBlockBlobClient(path);
  const response = await client.deleteIfExists();
  return response.succeeded;
}

function isNotFound(error: unknown): boolean {
  const status = (error as { statusCode?: number })?.statusCode;
  return status === 404;
}
