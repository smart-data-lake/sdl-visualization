import type { Repositories } from '../../repositories.js';
import type { AzureStorageAuth } from '../../../config.js';
import { createTableStore } from './tables.js';
import { configRepository } from './configs.js';
import { runRepository } from './runs.js';
import { schemaStatsRepository } from './schemaStats.js';
import { scopeRepository } from './scopes.js';
import { tokenRepository } from './tokens.js';
import { workspaceRepository } from './workspaces.js';

/**
 * The Azure Table Storage driver.
 *
 * The key design it implements is described in keys.ts and in the README's storage
 * layout section: newest-first ordering baked into the row key by inv(), because Table
 * Storage sorts only by row key ascending and has no $orderby.
 *
 * Configuration is passed in, never read from settings(), so the conformance suite can
 * create two of these against different accounts.
 */
export interface AzureTablesOptions {
  storage: AzureStorageAuth;
}

export function createAzureTablesRepositories(options: AzureTablesOptions): Repositories {
  const tables = createTableStore(options.storage);
  return {
    runs: runRepository(tables),
    scopes: scopeRepository(tables),
    workspaces: workspaceRepository(tables),
    tokens: tokenRepository(tables),
    schemaStats: schemaStatsRepository(tables),
    configs: configRepository(tables),
  };
}
