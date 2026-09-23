import { existsSync, readFileSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import MiniSearch from 'minisearch';
import { Context } from '@pushcorn/hocon-parser/lib/core/Context.js';
import { standardizeKeys } from '../src/util/ConfigExplorer/HoconParser.ts';
import {
  columnDocuments, descriptionDocument, elementDocuments,
  LIMITS, SEARCH_INDEX_OPTIONS, SEARCH_SCHEMA_VERSION, type SearchDocument,
} from '../src/util/ConfigExplorer/searchDocuments.ts';

/**
 * Builds the global search index for a statically served project - the `local;` and
 * `exported` backend modes, which have no backend to build one for them.
 *
 * The backend builds the same file from the same module (backend/src/services/search.ts);
 * this is the half that runs over a directory instead of a blob store.
 */

interface Options {
  publicDir: string; configPath?: string; descriptionDir: string; schemaDir: string;
  out: string; env?: string; version?: string;
}

function parseArgs(argv: string[]): Options {
  const flags = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 2) flags.set(argv[i].replace(/^--/, ''), argv[i + 1]);
  const publicDir = flags.get('public') ?? 'public';
  return {
    publicDir,
    configPath: flags.get('config'),
    descriptionDir: flags.get('description') ?? path.join(publicDir, 'description'),
    schemaDir: flags.get('schema') ?? path.join(publicDir, 'schema'),
    out: flags.get('out') ?? path.join(publicDir, 'search', 'index.json'),
    env: flags.get('env'),
    version: flags.get('version'),
  };
}

/* ------------------------------------------------------------------- config */

/**
 * The exported configuration where SDLB wrote one, else the HOCON files. The exported form
 * is richer: _sourceDoc and _origin only exist there, so an index built
 * from HOCON covers less and says so.
 */
async function readConfig(options: Options): Promise<{ config: any; source: 'exported' | 'hocon' }> {
  const exported = options.configPath ?? path.join(options.publicDir, 'exportedConfig.json');
  if (existsSync(exported) && exported.endsWith('.json')) {
    return { config: JSON.parse(readFileSync(exported, 'utf8')), source: 'exported' };
  }

  const configDir = options.configPath ?? path.join(options.publicDir, 'config');
  if (!existsSync(configDir)) throw new Error(`no configuration found: neither ${exported} nor ${configDir}`);

  const indexFile = path.join(configDir, 'index');
  const names = existsSync(indexFile)
    ? readFileSync(indexFile, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean)
    : readdirSync(configDir).filter((f) => f.endsWith('.conf'));

  const files = names.map((name) => path.resolve(configDir, name));
  const envConfig = options.env ? path.resolve(options.publicDir, 'envConfig', `${options.env}.conf`) : undefined;
  if (envConfig && existsSync(envConfig)) files.push(envConfig);

  // the browser remaps the parser's file source to http; under Node the file source is the one that works
  const text = files.map((file) => `include file("${file}")`).join('\n');
  const parsed: any = await new Context({ text, strict: true }).resolve();
  const { env, ...config } = standardizeKeys(parsed) as any;
  return { config, source: 'hocon' };
}

/* -------------------------------------------------------------- descriptions */

function markdownFiles(dir: string, base = dir): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return markdownFiles(full, base);
    return entry.toLowerCase().endsWith('.md') ? [path.relative(base, full).split(path.sep).join('/')] : [];
  });
}

/* ------------------------------------------------------------------ schemas */

/**
 * The newest schema export, whatever it says. One that failed carries an error message and no
 * columns; that is a fact about the export, not something for the indexer to work around.
 */
function newestSchema(schemaDir: string, dataObjectId: string): { schema: any; tstamp: number } | undefined {
  const indexFile = path.join(schemaDir, `${dataObjectId}.schema.index`);
  if (!existsSync(indexFile)) return undefined;
  const names = readFileSync(indexFile, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean);
  const name = names[names.length - 1];
  const file = name ? path.join(schemaDir, name) : undefined;
  if (!file || !existsSync(file)) return undefined;
  return { schema: JSON.parse(readFileSync(file, 'utf8')), tstamp: Number(/\.(\d+)\./.exec(name!)?.[1] ?? 0) };
}

/* -------------------------------------------------------------------- build */

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const { config, source } = await readConfig(options);

  const documents: SearchDocument[] = elementDocuments(config);
  const elements = documents.length;

  for (const filename of markdownFiles(options.descriptionDir)) {
    const doc = descriptionDocument(filename, readFileSync(path.join(options.descriptionDir, filename), 'utf8'));
    if (doc) documents.push(doc);
  }
  const descriptions = documents.length - elements;

  for (const dataObjectId of Object.keys(config.dataObjects ?? {})) {
    const found = newestSchema(options.schemaDir, dataObjectId);
    if (found) documents.push(...columnDocuments(dataObjectId, found.schema, found.tstamp));
  }
  const columns = documents.length - elements - descriptions;

  const index = new MiniSearch<SearchDocument>(SEARCH_INDEX_OPTIONS as any);
  index.addAll(documents);

  const serialized = JSON.stringify(index);
  const bundle = {
    meta: {
      version: options.version ?? 'local',
      builtAt: new Date().toISOString(),
      schemaVersion: SEARCH_SCHEMA_VERSION,
      documentCount: documents.length,
      counts: { element: elements, description: descriptions, column: columns },
      sizeBytes: Buffer.byteLength(serialized, 'utf8'),
      // the HOCON path has no exporter metadata, so it indexes less than the exported one
      truncated: source === 'hocon' ? ['column' as const] : undefined,
    },
    index: JSON.parse(serialized),
  };

  mkdirSync(path.dirname(options.out), { recursive: true });
  writeFileSync(options.out, JSON.stringify(bundle));
  const size = (Buffer.byteLength(JSON.stringify(bundle), 'utf8') / 1024).toFixed(0);
  console.log(`${options.out}: ${documents.length} documents (${elements} elements, ${descriptions} descriptions, ${columns} columns), ${size} kB, from ${source} config`);
  if (source === 'hocon') {
    console.log('note: HOCON config has no _sourceDoc or _origin - those are written by SDLB\'s exporter');
  }
  if (bundle.meta.sizeBytes > LIMITS.maxIndexBytes) {
    console.error(`warning: the index is over the ${LIMITS.maxIndexBytes} byte limit and the app will refuse to load it`);
  }
}

await main();
