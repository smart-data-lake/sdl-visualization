import type { Repositories } from '../../repositories.js';
import type { Settings } from '../../../config.js';
import { scopeRepository } from './scopes.js';
import { workspaceRepository } from './workspaces.js';

/**
 * The Azure Table Storage driver.
 *
 * The key design it implements is described in the README's storage layout section:
 * newest-first ordering baked into the row key by keys.ts's inv(), because Table
 * Storage sorts only by row key ascending and has no $orderby.
 */
export interface AzureTablesOptions {
  storage: Settings['storage'];
}

export function createAzureTablesRepositories(_options: AzureTablesOptions): Repositories {
  return {
    scopes: scopeRepository(),
    workspaces: workspaceRepository(),
  };
}
