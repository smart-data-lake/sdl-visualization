import { blobPaths, list, readBuffer, remove, writeBuffer } from '../store/blobs.js';
import type { Scope } from '../store/keys.js';
import type { DescriptionListEntry } from '../domain/types.js';
import { badRequest } from '../errors.js';
import { registerScope } from './scope.js';

/**
 * Descriptions are pure Blob Storage: the API's `{filename}` is the blob path
 * verbatim, slashes and all, so `dataObjects/int-airports.md` and
 * `images/train.png` land side by side under the version prefix and there is no
 * index to keep in sync. Listing them is one listBlobsFlat, and every field the
 * list response needs comes from the blob's own properties.
 */

const CONTENT_TYPES: Record<string, string> = {
  '.md': 'text/markdown',
  '.markdown': 'text/markdown',
  '.txt': 'text/plain',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
};

export function contentTypeOf(filename: string): string {
  const dot = filename.lastIndexOf('.');
  const extension = dot < 0 ? '' : filename.slice(dot).toLowerCase();
  return CONTENT_TYPES[extension] ?? 'application/octet-stream';
}

export function isMarkdown(filename: string): boolean {
  return contentTypeOf(filename) === 'text/markdown';
}

/**
 * `{filename}` arrives from the URL and becomes part of a blob path, so it must not
 * be able to climb out of its prefix or reach another version.
 */
export function assertSafeFilename(filename: string): string {
  const clean = filename.replace(/^\/+/, '');
  if (!clean) throw badRequest('filename must not be empty');
  if (clean.split('/').some((segment) => segment === '..' || segment === '.')) {
    throw badRequest('filename must not contain path traversal segments');
  }
  if (clean.includes('\\') || clean.includes('\0')) {
    throw badRequest('filename contains an illegal character');
  }
  return clean;
}

export async function putDescription(
  scope: Scope,
  version: string,
  filename: string,
  body: Buffer,
): Promise<void> {
  const clean = assertSafeFilename(filename);
  await writeBuffer(blobPaths.description(scope, version, clean), body, contentTypeOf(clean));
  await registerScope(scope);
}

export async function getDescription(
  scope: Scope,
  version: string,
  filename: string,
): Promise<{ body: Buffer; contentType: string } | undefined> {
  const clean = assertSafeFilename(filename);
  const body = await readBuffer(blobPaths.description(scope, version, clean));
  return body === undefined ? undefined : { body, contentType: contentTypeOf(clean) };
}

export async function deleteDescription(
  scope: Scope,
  version: string,
  filename: string,
): Promise<boolean> {
  return remove(blobPaths.description(scope, version, assertSafeFilename(filename)));
}

/**
 * SDLB camelises this response and renames `type` to `mediaType`, so the field
 * names here are load-bearing: snake_case `last_modified`, and a field literally
 * called `type`. An empty response makes SDLB's client throw, but that is its
 * problem with an empty repository, not something to paper over with a fake entry.
 */
export async function listDescriptions(
  scope: Scope,
  version: string,
): Promise<DescriptionListEntry[]> {
  const blobs = await list(blobPaths.descriptionsPrefix(scope, version));
  return blobs
    .map((blob) => ({
      name: blob.name,
      type: blob.contentType,
      size: blob.size,
      last_modified: blob.lastModified.toISOString(),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
