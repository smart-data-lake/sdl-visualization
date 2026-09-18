/**
 * The contents of the getting-started fixtures, so that specs assert against
 * named constants instead of magic strings. Keep in sync with
 * tests/e2e/fixtures (regenerate with fixtures/update-fixtures.sh).
 */
export const DATA_OBJECTS = [
  'btl-departures-arrivals-airports',
  'btl-distances',
  'ext-airports',
  'ext-departures',
  'int-airports',
  'int-departures',
  'stg-airports',
];

export const ACTIONS = [
  'compute-distances',
  'download-airports',
  'download-deduplicate-departures',
  'historize-airports',
  'join-departures-airports',
];

export const WORKFLOW = 'getting-started';

/** runs in the fixture state index, newest last */
export const RUNS = [
  { runId: 24, attemptId: 1, status: 'FAILED' },
  { runId: 24, attemptId: 2, status: 'SUCCEEDED' },
  { runId: 73, attemptId: 1, status: 'SUCCEEDED' },
  { runId: 74, attemptId: 1, status: 'SUCCEEDED' },
  { runId: 75, attemptId: 1, status: 'SUCCEEDED' },
];

/**
 * data objects the fixtures ship a schema export for. The newest export of int-airports and
 * btl-distances is an AnalysisException rather than a schema, which is what the getting-started
 * project happens to have produced; int-departures is ours (see fixtures/update-fixtures.sh) and
 * is the one with actual columns.
 */
export const WITH_SCHEMA = ['int-airports', 'btl-distances', 'int-departures'];

/**
 * The foreign keys the fixtures declare, added by us on top of the getting-started project - see
 * hocon/config/relations.conf and fixtures/patch-relations.py, which keep the two config sources
 * in step. fk_airline points outside the configuration on purpose.
 */
export const RELATIONS = [
  { from: 'int-departures', to: 'int-airports', columns: { estdepartureairport: 'ident' } },
  { from: 'int-departures', to: 'int-airports', columns: { estarrivalairport: 'ident' } },
  { from: 'btl-departures-arrivals-airports', to: 'int-airports', columns: { estarrivalairport: 'ident' } },
];

/** data objects that take part in a relation, i.e. the nodes of the relations graph with an edge */
export const RELATED_DATA_OBJECTS = ['btl-departures-arrivals-airports', 'int-airports', 'int-departures'];

/** data objects the fixtures ship a description markdown for */
export const WITH_DESCRIPTION = ['int-airports', 'btl-distances'];
