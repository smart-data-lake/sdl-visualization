import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, test } from 'vitest';
import { openDb } from '../../src/store/drivers/sqlite/db.js';
import { createSqliteRepositories } from '../../src/store/drivers/sqlite/index.js';

/**
 * A store written before a column existed must keep working. The schema is only
 * CREATE TABLE IF NOT EXISTS, so without the migration in openDb the next write fails with
 * "no column named ..." rather than ignoring the field.
 */
test('a runs table from an older store gains the columns added since', async () => {
  const file = path.join(mkdtempSync(path.join(tmpdir(), 'sdlb-migration-')), 'store.db');
  const old = new DatabaseSync(file);
  old.exec(`CREATE TABLE runs (
     repo TEXT NOT NULL, env TEXT NOT NULL, workflow TEXT NOT NULL,
     run_id INTEGER NOT NULL, attempt_id INTEGER NOT NULL,
     feed_sel TEXT, status TEXT, run_start_time TEXT, attempt_start_time TEXT,
     run_end_time TEXT, duration INTEGER, attempt_start_time_millis INTEGER,
     actions_status_json TEXT, data_objects_json TEXT, actions_json TEXT,
     build_version TEXT, app_version TEXT, blob_path TEXT,
     PRIMARY KEY (repo, env, workflow, run_id DESC, attempt_id DESC)
   ) WITHOUT ROWID`);
  old.close();

  openDb({ file }); // applies the migration
  const store = createSqliteRepositories({ file });
  const scope = { repo: 'r', env: 'dev' };
  await store.runs.putRun(scope, {
    name: 'wf',
    runId: 1,
    attemptId: 0,
    status: 'SUCCEEDED',
    selectedPartitionValues: 'dt=2024-01-01',
    blobPath: 'p/1/0.json',
  });

  expect((await store.runs.getRun(scope, 'wf', 1, 0))!.selectedPartitionValues).toBe('dt=2024-01-01');
});
