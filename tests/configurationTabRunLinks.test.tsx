/**
 * The "Last 5 runs" links of a data object or action (issue #132).
 *
 * They were absolute `/workflows/...` paths, which is right in flat routing and
 * lands outside the workspace once auth puts tenant/repo/env into the URL.
 */
import React from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, test, vi } from 'vitest';

const manifest = vi.hoisted(() => ({ current: {} as any }));
const stateFile = vi.hoisted(() => ({ current: undefined as any }));
vi.mock('../src/hooks/useManifest', () => ({
  useManifest: () => ({ data: manifest.current }),
}));

vi.mock('../src/hooks/useFetchData', () => ({
  useFetchDataObjectStats: () => ({ data: undefined }),
  useFetchRunsQuiet: (runs: any[]) => runs.map(() => ({ data: stateFile.current })),
  useFetchWorkflowRunsByElement: () => ({
    data: [{ name: 'getting-started', runId: 75, attemptId: 1, status: 'SUCCEEDED', attemptStartTime: '2024-01-01T00:00:00Z' }],
  }),
}));

import ConfigurationTab from '../src/components/ConfigExplorer/ConfigurationTab';
import { WorkspaceProvider } from '../src/hooks/useWorkspace';

function renderAt(pathname: string) {
  return renderToString(
    <MemoryRouter initialEntries={[pathname]}>
      <WorkspaceProvider>
        <ConfigurationTab data={{ type: 'CsvFileDataObject' }} elementName="int-airports" elementType="dataObjects" />
      </WorkspaceProvider>
    </MemoryRouter>,
  );
}

function runLinksAt(pathname: string) {
  const html = renderAt(pathname);
  return [...html.matchAll(/href="([^"]*workflows[^"]*)"/g)].map(m => m[1]);
}

describe('last runs links', () => {
  test('stay inside the workspace when routing is tenant-based', () => {
    manifest.current = { auth: { type: 'databricks' } };
    expect(runLinksAt('/acme/content/my-repo/prod/config/dataObjects/int-airports')).toEqual([
      '/acme/content/my-repo/prod/workflows/getting-started/75.1/table',
      '/acme/content/my-repo/prod/workflows/getting-started',
    ]);
  });

  test('are unchanged in flat routing', () => {
    manifest.current = {};
    expect(runLinksAt('/config/dataObjects/int-airports')).toEqual([
      '/workflows/getting-started/75.1/table',
      '/workflows/getting-started',
    ]);
  });
});

describe('last runs details (issue #133)', () => {
  test('show what the run wrote to the data object, once its state file is loaded', () => {
    manifest.current = {};
    stateFile.current = { actionsState: { 'historize-airports': {
      results: [{ dataObjectId: 'int-airports', partitionValues: [{ dt: '2024-01-01' }], metrics: { count: 42 } }],
    } } };
    const html = renderAt('/config/dataObjects/int-airports');
    expect(html).toContain('Written partitions');
    expect(html).toContain('dt=2024-01-01');
    expect(html).toContain('42 records');
    expect(html).toContain('href="/config/actions/historize-airports"');
  });

  test('give every action writing the data object in one run a row of its own', () => {
    manifest.current = {};
    stateFile.current = { actionsState: {
      'load-ch': { results: [{ dataObjectId: 'int-airports', partitionValues: [], metrics: { count: 10 } }] },
      'load-de': { results: [{ dataObjectId: 'int-airports', partitionValues: [], metrics: { count: 20 } }] },
    } };
    const html = renderAt('/config/dataObjects/int-airports');
    const bodyRows = html.split('<tbody>')[1].split('<tr').slice(1);
    expect(bodyRows).toHaveLength(2);
    // the run's own cells are shared by both rows
    expect(bodyRows[0]).toContain('rowspan="2"');
    expect(bodyRows[0]).toContain('load-ch');
    expect(bodyRows[0]).toContain('10 records');
    expect(bodyRows[1]).toContain('load-de');
    expect(bodyRows[1]).toContain('20 records');
    expect(bodyRows[1]).not.toContain('getting-started');
  });

  test('add no columns while there are no details', () => {
    manifest.current = {};
    stateFile.current = undefined;
    expect(renderAt('/config/dataObjects/int-airports')).not.toContain('<thead');
  });
});
