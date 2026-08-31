/**
 * Which media type a file name implies.
 *
 * It lives here rather than in services/descriptions.ts because a blob driver may need
 * it too: a filesystem has nowhere to record a content type, and deriving it from the
 * extension is byte-equivalent for every caller there is - putDescription already
 * passes contentTypeOf(name) on the way in, getDescription re-derives it on the way out
 * and ignores what was stored, and writeJson always writes application/json to a .json
 * path. It has to be the *same* map on both sides, though, or ".markdown" diverges the
 * moment one of them uses a different table.
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

export const DEFAULT_CONTENT_TYPE = 'application/octet-stream';

export function contentTypeOf(filename: string): string {
  const dot = filename.lastIndexOf('.');
  const extension = dot < 0 ? '' : filename.slice(dot).toLowerCase();
  return CONTENT_TYPES[extension] ?? DEFAULT_CONTENT_TYPE;
}

export function isMarkdown(filename: string): boolean {
  return contentTypeOf(filename) === 'text/markdown';
}
