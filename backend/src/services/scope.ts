import { repositories } from '../store/repositories.js';
import type { Scope } from '../store/types.js';
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

export function tenants(): string[] {
  return [settings().tenantName];
}

export async function repos(): Promise<string[]> {
  return (await repositories()).scopes.listRepos();
}

export async function envs(repo: string): Promise<string[]> {
  return (await repositories()).scopes.listEnvs(repo);
}

/**
 * Record that a scope exists. Called from every upload, so a repo and environment
 * appear in the workspace switcher as soon as SDLB has pushed anything to them, with
 * nothing to provision by hand.
 */
export async function registerScope(scope: Scope): Promise<void> {
  await (await repositories()).scopes.register(scope);
}
