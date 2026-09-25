import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  buildColumnLineageIndex, parseColumnLineage, type ColumnLineage,
} from '../src/util/ConfigExplorer/columnLineage.ts';

/**
 * Builds the column lineage index for a statically served project, from the newest
 * `<id>.lineage.<tstamp>.json` of every DataObject in the schema folder. The backend builds the
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

  const sources: { lineage: ColumnLineage; tstamp: number }[] = [];
  for (const indexFile of readdirSync(schemaDir).filter((f) => f.endsWith('.lineage.index'))) {
    // the index lists oldest first, as for schemas
    const names = readFileSync(path.join(schemaDir, indexFile), 'utf8').split('\n').map((l) => l.trim()).filter(Boolean);
    const name = names[names.length - 1];
    if (!name || !existsSync(path.join(schemaDir, name))) continue;
    const tstamp = Number(/\.(\d+)\./.exec(name)?.[1] ?? 0);
    for (const lineage of parseColumnLineage(JSON.parse(readFileSync(path.join(schemaDir, name), 'utf8')))) {
      sources.push({ lineage, tstamp });
    }
  }

  const index = buildColumnLineageIndex(sources, new Date().toISOString());
  mkdirSync(path.dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(index));
  console.log(`${out}: ${index.documents.length} documents, ${index.edges.length} column dependencies`);
}

main();
