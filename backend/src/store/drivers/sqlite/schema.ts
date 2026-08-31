/**
 * The relational schema, which is the point of this driver.
 *
 * Nothing here encodes an ordering into a string. Table Storage sorts only by row key
 * ascending and has no $orderby, which is why the Azure driver inverts numbers into
 * fixed-width strings; here newest-first is `ORDER BY run_id DESC`, so inv() does not
 * appear and the whole class of collation questions it raises does not either.
 *
 * Two structural differences from the Azure layout are worth naming:
 *
 *  - `run_elements` stores each element once. The Azure driver writes it once per action
 *    *and* once per data object it touched, because that is the only way to make "the
 *    last five runs of this element" a single partition query. Here the data-object index
 *    is a link table, so the row is not duplicated.
 *  - `scopes` is one table. The Meta table is two partitions - one listing repositories,
 *    one per repository listing environments - which a primary key expresses directly.
 *
 * WITHOUT ROWID where the table is only ever reached by its key, so the table *is* the
 * primary-key B-tree and an ordered LIMIT needs no temporary one.
 */
export const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS scopes (
     repo TEXT NOT NULL,
     env TEXT NOT NULL,
     last_seen_at TEXT,
     PRIMARY KEY (repo, env)
   ) WITHOUT ROWID`,

  `CREATE TABLE IF NOT EXISTS workspaces (
     host TEXT NOT NULL PRIMARY KEY,
     repos TEXT,
     envs TEXT,
     required_group TEXT
   ) WITHOUT ROWID`,

  `CREATE TABLE IF NOT EXISTS tokens (
     repo TEXT NOT NULL,
     env TEXT NOT NULL,
     id TEXT NOT NULL,
     email TEXT,
     label TEXT,
     created_at TEXT,
     expires_at TEXT,
     last_used_at TEXT,
     PRIMARY KEY (repo, env, id)
   ) WITHOUT ROWID`,

  `CREATE TABLE IF NOT EXISTS tstamps (
     repo TEXT NOT NULL,
     env TEXT NOT NULL,
     subtype TEXT NOT NULL,
     data_object_id TEXT NOT NULL,
     tstamp INTEGER NOT NULL,
     blob_path TEXT,
     size_bytes INTEGER,
     PRIMARY KEY (repo, env, subtype, data_object_id, tstamp DESC)
   ) WITHOUT ROWID`,

  `CREATE TABLE IF NOT EXISTS config_versions (
     repo TEXT NOT NULL,
     env TEXT NOT NULL,
     version TEXT NOT NULL,
     created_at TEXT,
     blob_path TEXT,
     num_data_objects INTEGER,
     num_actions INTEGER,
     num_connections INTEGER,
     PRIMARY KEY (repo, env, version)
   ) WITHOUT ROWID`,

  `CREATE TABLE IF NOT EXISTS config_elements (
     repo TEXT NOT NULL,
     env TEXT NOT NULL,
     version TEXT NOT NULL,
     element_type TEXT NOT NULL,
     id TEXT NOT NULL,
     type TEXT,
     name TEXT,
     layer TEXT,
     subject_area TEXT,
     feed TEXT,
     tags TEXT,
     connection_id TEXT,
     input_ids TEXT,
     output_ids TEXT,
     path TEXT,
     table_full_name TEXT,
     origin_path TEXT,
     origin_line INTEGER,
     description_snippet TEXT,
     search_text TEXT,
     PRIMARY KEY (repo, env, version, element_type, id)
   ) WITHOUT ROWID`,

  // What the ConfigElements index was built for and could never serve on Table Storage,
  // which has no substring filter. Nothing queries it yet - see ConfigRepository - but
  // here it would be one statement.
  `CREATE INDEX IF NOT EXISTS config_elements_search
     ON config_elements (repo, env, version, search_text)`,

  `CREATE TABLE IF NOT EXISTS elements (
     repo TEXT NOT NULL,
     env TEXT NOT NULL,
     element_type TEXT NOT NULL,
     id TEXT NOT NULL,
     last_version TEXT,
     last_seen_at TEXT,
     type TEXT,
     layer TEXT,
     PRIMARY KEY (repo, env, element_type, id)
   ) WITHOUT ROWID`,

  `CREATE TABLE IF NOT EXISTS workflows (
     repo TEXT NOT NULL,
     env TEXT NOT NULL,
     workflow TEXT NOT NULL,
     num_runs INTEGER,
     num_attempts INTEGER,
     last_status TEXT,
     last_attempt_start_time TEXT,
     last_duration INTEGER,
     last_num_actions INTEGER,
     last_run_id INTEGER,
     last_attempt_id INTEGER,
     PRIMARY KEY (repo, env, workflow)
   ) WITHOUT ROWID`,

  `CREATE TABLE IF NOT EXISTS runs (
     repo TEXT NOT NULL,
     env TEXT NOT NULL,
     workflow TEXT NOT NULL,
     run_id INTEGER NOT NULL,
     attempt_id INTEGER NOT NULL,
     feed_sel TEXT,
     status TEXT,
     run_start_time TEXT,
     attempt_start_time TEXT,
     run_end_time TEXT,
     duration INTEGER,
     attempt_start_time_millis INTEGER,
     actions_status_json TEXT,
     data_objects_json TEXT,
     actions_json TEXT,
     build_version TEXT,
     app_version TEXT,
     blob_path TEXT,
     PRIMARY KEY (repo, env, workflow, run_id DESC, attempt_id DESC)
   ) WITHOUT ROWID`,

  `CREATE TABLE IF NOT EXISTS run_elements (
     repo TEXT NOT NULL,
     env TEXT NOT NULL,
     workflow TEXT NOT NULL,
     run_id INTEGER NOT NULL,
     attempt_id INTEGER NOT NULL,
     action_id TEXT NOT NULL,
     state TEXT,
     attempt_start_time TEXT,
     duration_millis INTEGER,
     main_input_count INTEGER,
     main_output_count INTEGER,
     input_ids_json TEXT,
     output_ids_json TEXT,
     msg TEXT,
     PRIMARY KEY (repo, env, workflow, run_id DESC, attempt_id DESC, action_id)
   ) WITHOUT ROWID`,

  `CREATE INDEX IF NOT EXISTS run_elements_by_action
     ON run_elements (repo, env, action_id, run_id DESC, attempt_id DESC)`,

  // The second Azure partition, without storing the element row twice.
  `CREATE TABLE IF NOT EXISTS run_element_data_objects (
     repo TEXT NOT NULL,
     env TEXT NOT NULL,
     data_object_id TEXT NOT NULL,
     workflow TEXT NOT NULL,
     run_id INTEGER NOT NULL,
     attempt_id INTEGER NOT NULL,
     action_id TEXT NOT NULL,
     PRIMARY KEY (repo, env, data_object_id, run_id DESC, attempt_id DESC, workflow, action_id)
   ) WITHOUT ROWID`,
];
