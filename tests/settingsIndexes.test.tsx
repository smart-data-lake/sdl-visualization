// @vitest-environment jsdom
/**
 * The Indexes settings page: each rebuild goes to the scope the page names, and says what it did.
 */
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from 'react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, test, vi } from 'vitest';

afterEach(cleanup);

vi.mock('../src/hooks/useWorkspace', () => ({
  useWorkspace: () => ({ tenant: 'PrivateTenant', repo: undefined, env: undefined, workspaceEnabled: true }),
}));

vi.mock('../src/hooks/useFetchData', () => ({
  useFetchRepos: () => ({ data: ['getting-started', 'other'] }),
  useFetchEnvs: () => ({ data: ['dev'] }),
}));

const rebuildSearchIndex = vi.fn(async () => ({
  built: false, reason: 'fresh', durationMs: 5, version: 'v2', builtAt: '', schemaVersion: 1, documentCount: 3,
  counts: { element: 2, description: 1, column: 0 },
}));
const rebuildStateIndex = vi.fn(async () => ({
  workflows: 1, attempts: 5, durationMs: 1200, failed: [{ path: 'r/e/state/w/1/1.json', error: 'broken' }],
}));
const rebuildLineageIndex = vi.fn(async (): Promise<any> => {
  throw new Error('column lineage not found (404)');
});

vi.mock('../src/api/Fetcher', () => ({
  fetcher: () => ({
    getConfigVersions: async () => ['v2', 'v1'],
    rebuildSearchIndex,
    rebuildStateIndex,
    rebuildLineageIndex,
  }),
}));

import Indexes from '../src/components/Settings/Indexes';

function renderPage() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={['/PrivateTenant/settings/indexes?repo=other&env=dev']}>
        <Indexes />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const rebuildButtons = () => screen.getAllByRole('button', { name: 'Rebuild' });

describe('the Indexes page', () => {
  test('rebuilds in the scope handed over in the query', async () => {
    renderPage();
    await userEvent.click(rebuildButtons()[0]);
    expect(rebuildSearchIndex).toHaveBeenCalledWith('PrivateTenant', 'other', 'dev', undefined, false);
    expect(await screen.findByText(/Not rebuilt, the configuration is unchanged/)).toBeTruthy();
  });

  test('names the state files a state index rebuild could not read', async () => {
    renderPage();
    await userEvent.click(rebuildButtons()[1]);
    expect(rebuildStateIndex).toHaveBeenCalledWith('PrivateTenant', 'other', 'dev');
    expect(await screen.findByText(/5 attempts of 1 workflows.*1 state files could not be read.*broken/)).toBeTruthy();
  });

  test('shows a failed rebuild rather than throwing it', async () => {
    renderPage();
    await userEvent.click(rebuildButtons()[2]);
    expect(await screen.findByText('column lineage not found (404)')).toBeTruthy();
  });
});
