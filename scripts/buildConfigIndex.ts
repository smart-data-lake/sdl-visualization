import { existsSync, readdirSync, readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { selectedPartitionValues } from '../src/util/WorkflowsExplorer/partitionValues.ts';

/**
 * Builds the indexes a statically served project (`local;`) reads its state and configuration
 * through: `<state>/index.json`, one run per line (JSON Lines), and `<config>/index`, one config
 * file per line. The backend derives the same run record at ingest (backend/src/domain/stateFile.ts).
 */

const RUN_STATUS_PRIORITY = ['FAILED', 'CANCELLED', 'RUNNING', 'SUCCEEDED', 'SKIPPED', 'INITIALIZING', 'INITIALIZED', 'PREPARING', 'PREPARED', 'PENDING'];

/** The files below `dir` with the given extension, except the indexes, relative to `dir`. */
function listFiles(dir: string, extension: string): string[] {
  const walk = (rel: string): string[] => readdirSync(path.join(dir, rel)).sort().flatMap((name) => {
    const file = path.posix.join(rel, name);
    if (statSync(path.join(dir, file)).isDirectory()) return walk(file);
    return name.endsWith(extension) && !name.startsWith('index') ? [file] : [];
  });
  return walk('');
}

const idOf = (e: any): string => (typeof e === 'string' ? e : e?.id);

/** Older state files nest results in `subFeed` and wrap ids in objects; flatten both. */
function normalizeAction(action: any): any {
  return {
    ...action,
    inputIds: (action.inputIds ?? []).map(idOf),
    outputIds: (action.outputIds ?? []).map(idOf),
    results: (action.results ?? []).map((r: any) => ({ ...r, ...r.subFeed })),
  };
}

function writtenDataObjects(action: any): string[] {
  if (action.outputIds.length) return action.outputIds;
  return action.results.map((r: any) => r.dataObjectId);
}

function runStatus(actions: any[]): string {
  const indexes = actions.map((a) => {
    const index = RUN_STATUS_PRIORITY.indexOf(a.state);
    if (index < 0) throw new Error(`unknown action state ${a.state}`);
    return index;
  });
  return RUN_STATUS_PRIORITY[Math.min(RUN_STATUS_PRIORITY.length - 1, ...indexes)];
}

/** Milliseconds of an ISO-8601 duration such as "PT3.6266377S" or "PT1M30S". */
function durationMillis(duration: string): number {
  const match = /^P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/.exec(duration);
  if (!match) throw new Error(`invalid duration ${duration}`);
  const [, d, h, m, s] = match.map((v) => Number(v ?? 0));
  return (d * 86_400 + h * 3_600 + m * 60 + s) * 1000;
}

/** The latest end any action recorded, else start + duration, never before the attempt started. */
function runEndTime(stateFile: any, actions: any[]): string {
  // older SDLB versions wrote local time without a zone; keep it zoneless rather than guess one
  const zoneless = !/(Z|[+-]\d{2}:?\d{2})$/.test(stateFile.attemptStartTime);
  const millis = (iso: string) => Date.parse(zoneless && !/(Z|[+-]\d{2}:?\d{2})$/.test(iso) ? `${iso}Z` : iso);
  let latest = millis(stateFile.attemptStartTime);
  for (const action of actions) {
    if (action.endTstmp) latest = Math.max(latest, millis(action.endTstmp));
    else if (action.startTstmp && action.duration) latest = Math.max(latest, millis(action.startTstmp) + durationMillis(action.duration));
  }
  const iso = new Date(latest).toISOString();
  return zoneless ? iso.slice(0, -1) : iso;
}

/**
 * The actions in topological order: an action follows every action that wrote one of the data
 * objects it reads, and of the actions ready at each step the alphabetically first is taken.
 * Mirrors actionsInDagOrder in backend/src/domain/stateFile.ts.
 */
function actionsInDagOrder(actionsState: Record<string, any>): string[] {
  const producers = new Map<string, string[]>();
  for (const [name, action] of Object.entries(actionsState)) {
    for (const id of writtenDataObjects(action)) producers.set(id, [...(producers.get(id) ?? []), name]);
  }
  const predecessors = new Map(Object.entries(actionsState).map(([name, action]) => [
    name, new Set<string>(action.inputIds.flatMap((id: string) => producers.get(id) ?? []).filter((p: string) => p !== name)),
  ]));
  const remaining = new Set(Object.keys(actionsState));
  const order: string[] = [];
  while (remaining.size > 0) {
    const ready = [...remaining].filter((name) => [...predecessors.get(name)!].every((p) => !remaining.has(p)));
    // a cycle SDLB's DAG cannot produce, but a hand written state file can
    if (ready.length === 0) return [...order, ...[...remaining].sort()];
    const next = ready.sort()[0];
    order.push(next);
    remaining.delete(next);
  }
  return order;
}

/** The index record of one state file, `file` being its path relative to the state folder. */
export function indexRecord(data: any, file: string): Record<string, unknown> {
  const actionsState: Record<string, any> = Object.fromEntries(
    Object.entries<any>(data.actionsState).map(([name, action]) => [name, normalizeAction(action)]),
  );
  const actions = Object.values(actionsState);
  const selected = actionsInDagOrder(actionsState).map((name) => selectedPartitionValues(actionsState[name])).find(Boolean);
  return {
    name: data.appConfig.applicationName,
    runId: data.runId,
    attemptId: data.attemptId,
    feedSel: data.appConfig.feedSel,
    runStartTime: data.runStartTime,
    attemptStartTime: data.attemptStartTime,
    runEndTime: runEndTime(data, actions),
    status: runStatus(actions),
    actions: Object.fromEntries(Object.entries(actionsState).map(([name, action]) => [
      name, { state: action.state, dataObjects: writtenDataObjects(action) },
    ])),
    buildVersion: data.sdlbVersionInfo?.version ?? null,
    appVersion: data.appVersionInfo?.version ?? null,
    path: file,
    // left out rather than null when nothing was selected, as the backend leaves it out
    ...(selected ? { selectedPartitionValues: selected } : {}),
  };
}

function buildStateIndex(dir: string): void {
  const files = listFiles(dir, '.json');
  const lines = files.map((file) => {
    try {
      return JSON.stringify(indexRecord(JSON.parse(readFileSync(path.join(dir, file), 'utf8')), file));
    } catch (e) {
      throw new Error(`reading state file ${path.join(dir, file)}: ${(e as Error).message}`);
    }
  });
  writeFileSync(path.join(dir, 'index.json'), lines.map((l) => `${l}\n`).join(''));
  console.log(`${path.join(dir, 'index.json')}: ${lines.length} runs`);
}

function buildConfigIndex(dir: string): void {
  const files = listFiles(dir, '.conf');
  writeFileSync(path.join(dir, 'index'), files.map((f) => `${f}\n`).join(''));
  console.log(`${path.join(dir, 'index')}: ${files.length} config files`);
}

function main(): void {
  const flags = new Map<string, string>();
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i += 2) flags.set(argv[i].replace(/^--/, ''), argv[i + 1]);
  const dirs: [string, string, (dir: string) => void][] = [
    ['state', flags.get('state') ?? path.join('public', 'state'), buildStateIndex],
    ['config', flags.get('config') ?? path.join('public', 'config'), buildConfigIndex],
  ];
  for (const [kind, dir, build] of dirs) {
    if (existsSync(dir) && statSync(dir).isDirectory()) build(dir);
    else console.log(`no ${kind} folder at ${dir}, skipping the ${kind} index`);
  }
}

// importable, so tests can check the records without writing files
if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) main();
