import type { ElementType } from '../domain/types.js';

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

/**
 * A minted access token, as stored. `id` is the token's SHA-256 hash: only the hash is
 * kept, so a leak of the store does not leak anyone's access, and it doubles as the
 * token's identity in the UI.
 */
export interface StoredToken {
  id: string;
  email: string;
  label: string;
  createdAt: string;
  expiresAt?: string;
  lastUsedAt?: string;
}

/** Which of the two per-timestamp series a record belongs to. */
export type Subtype = 'schema' | 'stats';

/** One recorded schema or statistics snapshot: the index entry beside its blob. */
export interface TstampEntry {
  tstamp: number;
  blobPath: string;
  sizeBytes: number;
}

/** One stored configuration version: the index entry beside its blob. */
export interface ConfigVersionRecord {
  version: string;
  createdAt: string;
  blobPath: string;
  numDataObjects: number;
  numActions: number;
  numConnections: number;
}

/**
 * One element of one configuration version, projected flat.
 *
 * This is the index for questions that should not have to materialise the whole
 * configuration - see the note on searchText in services/config.ts about why the search
 * the UI offers does not currently use it.
 */
export interface ConfigElementRecord {
  id: string;
  elementType: ElementType;
  type?: string;
  name?: string;
  layer?: string;
  subjectArea?: string;
  feed?: string;
  tags?: string;
  connectionId?: string;
  inputIds?: string;
  outputIds?: string;
  path?: string;
  tableFullName?: string;
  originPath?: string;
  originLine?: number;
  descriptionSnippet?: string;
  /** Every leaf value, lowercased, for cheap containment without loading the blob. */
  searchText?: string;
}

/** Where an element was last seen, across versions. */
export interface LatestElementRecord {
  id: string;
  elementType: ElementType;
  lastVersion: string;
  lastSeenAt: string;
  type?: string;
  layer?: string;
}
