import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * The newest export of one kind (`schema`, `stats`, `lineage`) of a DataObject, resolved the way
 * the local fetcher does: the index if there is one, else the unversioned `<id>.<kind>.json`.
 */
export function newestExport(schemaDir: string, dataObjectId: string, kind: string): { file: string; tstamp?: number } | undefined {
  const indexFile = path.join(schemaDir, `${dataObjectId}.${kind}.index`);
  if (existsSync(indexFile)) {
    // the index lists oldest first
    const names = readFileSync(indexFile, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean);
    const name = names[names.length - 1];
    if (name) {
      const file = path.join(schemaDir, name);
      return existsSync(file) ? { file, tstamp: Number(/\.(\d+)\./.exec(name)?.[1] ?? 0) } : undefined;
    }
  }
  const unversioned = path.join(schemaDir, `${dataObjectId}.${kind}.json`);
  return existsSync(unversioned) ? { file: unversioned } : undefined;
}

/** The DataObjects having an export of the given kind, versioned or not. */
export function exportedDataObjects(schemaDir: string, kind: string): string[] {
  const suffix = new RegExp(`\\.${kind}\\.(index|json)$`);
  return [...new Set(readdirSync(schemaDir).filter((f) => suffix.test(f)).map((f) => f.replace(suffix, '')))].sort();
}
