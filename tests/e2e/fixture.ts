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

/** data objects the fixtures ship a schema export for */
export const WITH_SCHEMA = ['int-airports', 'btl-distances'];

/** data objects the fixtures ship a description markdown for */
export const WITH_DESCRIPTION = ['int-airports', 'btl-distances'];
