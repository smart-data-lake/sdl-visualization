import { DatabaseSync, type StatementSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { checkValues } from '../../limits.js';
import { SCHEMA } from './schema.js';

/**
 * The SQLite handle, and the two things every repository here needs from it.
 *
 * node:sqlite is in Node's core, so this driver adds no dependency. It is synchronous,
 * which is a real difference from the Azure driver: every call blocks the event loop.
 * For a 5000-row configuration inside one transaction that is a few milliseconds, which
 * is fine for development, the test suite and a single-instance host, and is the reason
 * this is not offered as a way to run the deployed service.
 */

export interface Db {
  /**
   * Insert or merge one row.
   *
   * COALESCE per column is exactly Azure's Merge mode: an absent or undefined field
   * binds as NULL and the stored value survives. That is what makes TokenRepository.touch
   * work - it writes lastUsedAt and nothing else, concurrently with other writers - and
   * it is why the merge is in SQL rather than a read-modify-write here.
   */
  upsert(table: string, keys: string[], values: Record<string, unknown>): void;
  /** The same, for many rows, in one transaction. */
  upsertMany(table: string, keys: string[], rows: Record<string, unknown>[]): void;
  all<T>(sql: string, ...params: unknown[]): T[];
  get<T>(sql: string, ...params: unknown[]): T | undefined;
  run(sql: string, ...params: unknown[]): void;
}

export interface SqliteOptions {
  /** ":memory:" for a throwaway store. */
  file: string;
}

export function openDb(options: SqliteOptions): Db {
  const database = new DatabaseSync(prepareFile(options.file));

  // WAL so that `yarn serve` and `yarn seed` against the same file do not collide, and a
  // busy timeout so that when they do, one waits instead of failing.
  database.exec('PRAGMA journal_mode = WAL');
  database.exec('PRAGMA busy_timeout = 5000');
  database.exec('PRAGMA foreign_keys = ON');
  for (const statement of SCHEMA) database.exec(statement);

  const cache = new Map<string, StatementSync>();
  const prepare = (sql: string): StatementSync => {
    let statement = cache.get(sql);
    if (!statement) cache.set(sql, (statement = database.prepare(sql)));
    return statement;
  };

  /**
   * Bind SQLite's accepted types. undefined becomes NULL, which the COALESCE in the
   * upsert reads as "leave the stored value alone".
   */
  const bind = (value: unknown): string | number | null =>
    value === undefined || value === null ? null : (value as string | number);

  function upsertSql(table: string, keys: string[], columns: string[]): string {
    const updates = columns
      .filter((column) => !keys.includes(column))
      .map((column) => `${column} = COALESCE(excluded.${column}, ${table}.${column})`);
    const insert =
      `INSERT INTO ${table} (${columns.join(', ')}) ` +
      `VALUES (${columns.map(() => '?').join(', ')}) ` +
      `ON CONFLICT (${keys.join(', ')}) DO `;
    // A row that is only its key has nothing to merge, and DO UPDATE SET with an empty
    // list is a syntax error.
    return insert + (updates.length > 0 ? `UPDATE SET ${updates.join(', ')}` : 'NOTHING');
  }

  function write(table: string, keys: string[], values: Record<string, unknown>): void {
    const checked = checkValues(values, table);
    const columns = Object.keys(checked);
    prepare(upsertSql(table, keys, columns)).run(...columns.map((c) => bind(checked[c])));
  }

  return {
    upsert: write,

    upsertMany(table: string, keys: string[], rows: Record<string, unknown>[]): void {
      if (rows.length === 0) return;
      // All or nothing: a half-written index is worse than none, because the workflow
      // recount would then be confidently wrong.
      database.exec('BEGIN');
      try {
        for (const row of rows) write(table, keys, row);
        database.exec('COMMIT');
      } catch (error) {
        database.exec('ROLLBACK');
        throw error;
      }
    },

    all<T>(sql: string, ...params: unknown[]): T[] {
      return prepare(sql).all(...params.map(bind)) as T[];
    },

    get<T>(sql: string, ...params: unknown[]): T | undefined {
      return prepare(sql).get(...params.map(bind)) as T | undefined;
    },

    run(sql: string, ...params: unknown[]): void {
      prepare(sql).run(...params.map(bind));
    },
  };
}

/**
 * A LIMIT clause cannot be parameterised away.
 *
 * `LIMIT ?` bound to null fails with "datatype mismatch", and the sentinel that would
 * mean "no limit" differs by dialect - -1 in SQLite, an error in Postgres, which wants
 * LIMIT ALL. So the clause is present or absent, and each form is its own prepared
 * statement.
 */
export const limitClause = (limit: number | undefined): string =>
  limit === undefined ? '' : ` LIMIT ${Math.max(0, Math.trunc(limit))}`;

function prepareFile(file: string): string {
  if (file === ':memory:') return file;
  const absolute = path.resolve(file);
  mkdirSync(path.dirname(absolute), { recursive: true });
  return absolute;
}
