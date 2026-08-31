/**
 * What the store trades in, with no backend in it.
 *
 * Nothing here mentions a partition key, a row key or a table. The Azure-shaped
 * entities those keys belong to live in drivers/azureTables/entities.ts, behind
 * mappers, so that a second driver is free to store the same records differently -
 * with real columns and real indexes, rather than imitating a key-value layout it has
 * no reason to.
 */

/** A repository and environment. There is no tenant dimension - see services/scope.ts. */
export interface Scope {
  repo: string;
  env: string;
}

/**
 * A per-workspace rule, or nothing.
 *
 * Absent means the workspace may see everything, so a deployment that needs no rules
 * needs no rows. `repos` and `envs` are comma-separated allowlists; empty or absent
 * means every repository / every environment.
 */
export interface WorkspaceRule {
  repos?: string;
  envs?: string;
  requiredGroup?: string;
}
