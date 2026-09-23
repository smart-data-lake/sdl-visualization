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
vi.mock('../src/hooks/useManifest', () => ({
  useManifest: () => ({ data: manifest.current }),
}));

vi.mock('../src/hooks/useFetchData', () => ({
  useFetchDataObjectStats: () => ({ data: undefined }),
  useFetchWorkflowRunsByElement: () => ({
    data: [{ name: 'getting-started', runId: 75, attemptId: 1, status: 'SUCCEEDED', attemptStartTime: '2024-01-01T00:00:00Z' }],
  }),
}));

import ConfigurationTab from '../src/components/ConfigExplorer/ConfigurationTab';
import { WorkspaceProvider } from '../src/hooks/useWorkspace';

function runLinksAt(pathname: string) {
  const html = renderToString(
    <MemoryRouter initialEntries={[pathname]}>
      <WorkspaceProvider>
        <ConfigurationTab data={{ type: 'CsvFileDataObject' }} elementName="int-airports" elementType="dataObjects" />
      </WorkspaceProvider>
    </MemoryRouter>,
  );
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
