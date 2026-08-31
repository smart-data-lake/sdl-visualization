import { settings } from '../config.js';
import type {
  ConfigElementRecord,
  ConfigVersionRecord,
  LatestElementRecord,
  Scope,
  StoredToken,
  Subtype,
  TstampEntry,
  WorkspaceRule,
} from './types.js';

/**
 * The store, as named operations rather than as queries.
 *
 * Every method here is something the service layer actually wants, which is the point.
 * The interface it replaced was `listPartition(table, partitionKey, {limit, select})`,
 * and an interface whose only question is "scan one partition by row key" can be
 * answered by exactly one kind of store: a driver behind it either is Table Storage or
 * pretends to be. Naming the operations instead lets each driver answer in its own
 * terms - see the table in the README - and it moved three Table Storage workarounds
 * out of services/ in the process.
 */

export interface ScopeRepository {
  /**
   * Record that a repository and environment exist. Called from every upload, so a
   * scope appears in the workspace switcher as soon as SDLB has pushed anything to it.
   */
  register(scope: Scope): Promise<void>;
  /** Every known repository, in name order. */
  listRepos(): Promise<string[]>;
  /** Every known environment of one repository, in name order. */
  listEnvs(repo: string): Promise<string[]>;
}

export interface WorkspaceRepository {
  /**
   * The rule for one workspace, or undefined if it has none - which means it may see
   * everything. `workspaceHost` is the host without a scheme, as
   * auth/verifyBearer.ts's encodeWorkspaceRowKey produces it.
   */
  getRule(workspaceHost: string): Promise<WorkspaceRule | undefined>;
  /**
   * Provision a rule. Nothing in the request path calls this - workspace rules are set
   * out of band, and until now that meant a table editor, which is also why the tests
   * reached past the store to write one. It exists so a rule can be expressed at all on
   * a backend that is not Azure.
   */
  putRule(workspaceHost: string, rule: WorkspaceRule): Promise<void>;
}

export interface TokenRepository {
  put(scope: Scope, token: StoredToken): Promise<void>;
  get(scope: Scope, id: string): Promise<StoredToken | undefined>;
  /** Every token of one scope. Order is not significant - the SPA sorts. */
  list(scope: Scope): Promise<StoredToken[]>;
  delete(scope: Scope, id: string): Promise<void>;
  /**
   * Record that a token was used, leaving every other field alone.
   *
   * This is the operation that pins merge semantics for the whole store: it writes one
   * field of a row that another request may be writing at the same time, so a driver
   * that implemented it as a read-modify-write would lose the other write. Callers treat
   * it as best effort - a failed touch must not cost anyone their request.
   */
  touch(scope: Scope, id: string, at: string): Promise<void>;
}

export interface SchemaStatsRepository {
  put(scope: Scope, subtype: Subtype, dataObjectId: string, entry: TstampEntry): Promise<void>;
  /**
   * The timestamps recorded for one data object, newest first.
   *
   * Newest first is part of the answer, not a happy accident of the storage layout:
   * tstampAt takes the first entry at or before a moment, and the SPA shows the newest
   * schema by default.
   */
  listTstamps(scope: Scope, subtype: Subtype, dataObjectId: string): Promise<number[]>;
}

export interface ConfigRepository {
  putVersion(scope: Scope, version: ConfigVersionRecord): Promise<void>;
  /** Every stored version name. Order is not significant - the SPA sorts and reverses. */
  listVersions(scope: Scope): Promise<string[]>;
  /**
   * Replace the flat index of one version's elements.
   *
   * Nothing reads this yet. It was built as a search index and then could not serve
   * the search, because Table Storage has no substring filter - see services/config.ts.
   * It is kept because it is what a store that can answer such a query would need, and
   * because dropping it would make the write path lie about what is recorded.
   */
  putElements(scope: Scope, version: string, elements: ConfigElementRecord[]): Promise<void>;
  /** Where each element was last seen. Also write-only today, for the same reason. */
  putLatestElements(scope: Scope, elements: LatestElementRecord[]): Promise<void>;
}

export interface Repositories {
  scopes: ScopeRepository;
  workspaces: WorkspaceRepository;
  tokens: TokenRepository;
  schemaStats: SchemaStatsRepository;
  configs: ConfigRepository;
}

let resolved: Promise<Repositories> | undefined;

/**
 * The repositories this deployment is configured for.
 *
 * The driver is imported dynamically so that only the configured one is ever loaded:
 * a deployment on the local driver should not parse the Azure SDKs, and vice versa.
 * The specifier has to be a literal - a template one defeats esbuild's static
 * analysis, becomes a runtime require, and breaks inside the bundle.
 */
export function repositories(): Promise<Repositories> {
  if (!resolved) resolved = build();
  return resolved;
}

/** Only for tests, which point successive cases at different stores. */
export function resetStore(): void {
  resolved = undefined;
}

async function build(): Promise<Repositories> {
  const { createAzureTablesRepositories } = await import('./drivers/azureTables/index.js');
  return createAzureTablesRepositories({ storage: settings().storage });
}
