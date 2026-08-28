import { TABLES, listPartition, upsert } from '../store/tables.js';
import { keys, type Scope } from '../store/keys.js';
import { settings } from '../config.js';

/**
 * The repo/env registry behind GET /repo and GET /envs.
 *
 * There is no tenant dimension: this service is deployed once per tenant, so the
 * `tenant` parameter every operation carries is accepted for compatibility with the
 * existing contract and then ignored. GET /tenants answers with the single configured
 * name, and that answer is what the SPA adopts - it no longer carries a default of its
 * own, so SDLB_TENANT_NAME is the only place the name is decided. The default is still
 * "PrivateTenant", but now only as a default rather than a constant two codebases have
 * to agree on.
 */

interface MetaEntity {
  partitionKey: string;
  rowKey: string;
  lastSeenAt: string;
}

export function tenants(): string[] {
  return [settings().tenantName];
}

export async function repos(): Promise<string[]> {
  const entities = await listPartition<MetaEntity>(TABLES.meta, keys.metaRepos());
  return entities.map((e) => e.rowKey).sort();
}

export async function envs(repo: string): Promise<string[]> {
  const entities = await listPartition<MetaEntity>(TABLES.meta, keys.metaEnvs(repo));
  return entities.map((e) => e.rowKey).sort();
}

/**
 * Record that a scope exists. Called from every upload, so a repo and environment
 * appear in the workspace switcher as soon as SDLB has pushed anything to them, with
 * nothing to provision by hand.
 */
export async function registerScope(scope: Scope): Promise<void> {
  const now = new Date().toISOString();
  await Promise.all([
    upsert(TABLES.meta, {
      partitionKey: keys.metaRepos(),
      rowKey: scope.repo,
      lastSeenAt: now,
    }),
    upsert(TABLES.meta, {
      partitionKey: keys.metaEnvs(scope.repo),
      rowKey: scope.env,
      lastSeenAt: now,
    }),
  ]);
}
