import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  buildColumnLineageIndex, parseColumnLineage, type ColumnLineage,
} from '../src/util/ConfigExplorer/columnLineage.ts';
import { exportedDataObjects, newestExport } from './exportFiles.ts';

/**
 * Builds the column lineage index for a statically served project, from the newest
 * lineage export of every DataObject in the schema folder (`<id>.lineage.<tstamp>.json` via its
 * index, else the unversioned `<id>.lineage.json`). The backend builds the
 * same file from the same module (backend/src/services/columnLineageIndex.ts).
 */

function parseArgs(argv: string[]): { schemaDir: string; out: string } {
  const flags = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 2) flags.set(argv[i].replace(/^--/, ''), argv[i + 1]);
  const schemaDir = flags.get('schema') ?? path.join('public', 'schema');
  return { schemaDir, out: flags.get('out') ?? path.join(schemaDir, 'columnLineage.json') };
}

function main(): void {
  const { schemaDir, out } = parseArgs(process.argv.slice(2));
  if (!existsSync(schemaDir)) throw new Error(`no schema folder at ${schemaDir}`);

  const sources: { lineage: ColumnLineage; tstamp?: number }[] = [];
  for (const dataObjectId of exportedDataObjects(schemaDir, 'lineage')) {
    const found = newestExport(schemaDir, dataObjectId, 'lineage');
    if (!found) continue;
    for (const lineage of parseColumnLineage(JSON.parse(readFileSync(found.file, 'utf8')))) {
      sources.push({ lineage, tstamp: found.tstamp });
    }
  }

  const index = buildColumnLineageIndex(sources, new Date().toISOString());
  mkdirSync(path.dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(index));
  console.log(`${out}: ${index.documents.length} documents, ${index.edges.length} column dependencies`);
}

main();
