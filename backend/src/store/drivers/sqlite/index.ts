import type { Repositories } from '../../repositories.js';
import { openDb, type SqliteOptions } from './db.js';
import { buildRepositories } from './repositories.js';

/**
 * The SQLite driver: the local backend, and the answer to whether the store can be
 * relational.
 *
 * It uses node:sqlite from Node's core, so it adds no dependency, and real columns with
 * real indexes rather than a key-value table in a database costume - see schema.ts.
 *
 * Not a way to run the deployed service: node:sqlite is synchronous, so every call
 * blocks the event loop, and one file is not something a scaled-out Function app can
 * share. It is for development, the test suite, and demonstrating that the store's
 * interface does not presuppose Azure.
 */
export function createSqliteRepositories(options: SqliteOptions): Repositories {
  return buildRepositories(openDb(options));
}
