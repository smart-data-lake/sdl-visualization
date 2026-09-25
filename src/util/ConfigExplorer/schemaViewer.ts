export const SCHEMA_VIEWER_URL = 'https://smartdatalake.ch/json-schema-viewer';

/**
 * Link to the SDLB configuration schema viewer for an element's type, e.g. `actions/CopyAction`.
 * Only SDLB's own types are described there, so a custom class outside `io.smartdatalake` gets none.
 * @param elementType the configuration section: dataObjects, actions or connections
 */
export function schemaViewerUrl(elementType: string, type: unknown): string | undefined {
  if (typeof type !== 'string' || !type) return undefined;
  const lastDot = type.lastIndexOf('.');
  if (lastDot >= 0 && !type.startsWith('io.smartdatalake.')) return undefined;
  return `${SCHEMA_VIEWER_URL}?path=${encodeURIComponent(elementType)}/${encodeURIComponent(type.substring(lastDot + 1))}`;
}
