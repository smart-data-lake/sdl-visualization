// @vitest-environment jsdom
/**
 * The Access Token page, which shows both places one token points at - MCP and the
 * upload API - and names its own scope.
 *
 * The page is mounted at /:tenant/settings/*, which carries no repo or env, so taking
 * them from useWorkspace meant it refused to issue anything at all. The mock below is
 * the truth about that route; "offers the form" is the regression test.
 */
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// vitest runs without `globals`, so testing-library does not register its own
// auto-cleanup and every render would stack on the last one's DOM.
afterEach(cleanup);

const MCP = 'https://sdlb-demo-funcapp.azurewebsites.net/mcp/getting-started/dev';
const UPLOAD = 'https://sdlb-demo-funcapp.azurewebsites.net/api/v1';

// What /:tenant/settings/tokens actually gives you: a tenant, and no scope.
vi.mock('../src/hooks/useWorkspace', () => ({
  useWorkspace: () => ({
    tenant: 'PrivateTenant',
    repo: undefined,
    env: undefined,
    section: 'settings',
    workspaceEnabled: true,
  }),
}));

// What the backend has. Mutable, because a component re-renders and asks again -
// mockReturnValueOnce would answer the first render only.
let known = { repos: ['getting-started'], envs: ['dev'] };
beforeEach(() => (known = { repos: ['getting-started'], envs: ['dev'] }));
vi.mock('../src/hooks/useFetchData', () => ({
  useFetchRepos: () => ({ data: known.repos }),
  useFetchEnvs: () => ({ data: known.envs }),
}));

const createMcpToken = vi.fn(async () => ({
  id: 'x',
  label: 'l',
  email: 'e',
  createdAt: '',
  token: 'sdlb_issued',
}));

vi.mock('../src/api/Fetcher', () => ({
  fetcher: () => ({
    capabilities: () => ({ userManagement: false, mcpTokens: true }),
    mcpUrl: () => MCP,
    uploadUrl: () => UPLOAD,
    listMcpTokens: async () => [],
    createMcpToken,
    revokeMcpToken: async () => undefined,
  }),
}));

import AccessTokens, { isValidName, uiBackendHocon } from '../src/components/Settings/AccessTokens';

const show = (entries = ['/PrivateTenant/settings/tokens']) =>
  render(
    <MemoryRouter initialEntries={entries}>
      <AccessTokens />
    </MemoryRouter>,
  );

/** The combobox for a scope field, by its label. */
const field = (label: string) => screen.getByRole('combobox', { name: label });

describe('the access token page on the route it is actually mounted at', () => {
  test('offers the form rather than refusing for want of a repository', async () => {
    show();
    expect(screen.queryByText(/Choose a repository and environment first/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Issue' })).toBeTruthy();
  });

  test('seeds from what the backend has, so the common case needs no typing', async () => {
    show();
    await waitFor(() => expect((field('Repository') as HTMLInputElement).value).toBe('getting-started'));
    expect((field('Environment') as HTMLInputElement).value).toBe('dev');
  });

  test('starts empty on a fresh installation, where there is nothing to seed from', () => {
    known = { repos: [], envs: [] };
    show();
    expect((field('Repository') as HTMLInputElement).value).toBe('');
    expect((field('Environment') as HTMLInputElement).value).toBe('');
  });

  test('takes the scope from the query string when the header knew one', async () => {
    show(['/PrivateTenant/settings/tokens?repo=other-repo&env=prod']);
    await waitFor(() => expect((field('Repository') as HTMLInputElement).value).toBe('other-repo'));
    expect((field('Environment') as HTMLInputElement).value).toBe('prod');
  });
});

describe('issuing against a repository that does not exist yet', () => {
  test('mints for the name as typed, without it having to be confirmed', async () => {
    // A freeSolo Autocomplete fires onChange only on Enter or on picking an option, so
    // a component reading `value` would issue against the previous repository - exactly
    // the fresh-installation flow, where the new name is not in the list.
    createMcpToken.mockClear();
    show();
    const user = userEvent.setup();
    await waitFor(() => expect((field('Repository') as HTMLInputElement).value).toBe('getting-started'));

    await user.clear(field('Repository'));
    await user.type(field('Repository'), 'brand-new');
    await user.click(screen.getByRole('button', { name: 'Issue' }));

    await waitFor(() => expect(createMcpToken).toHaveBeenCalled());
    expect(createMcpToken.mock.calls[0].slice(0, 3)).toEqual(['PrivateTenant', 'brand-new', 'dev']);
  });

  test('refuses a name the backend would reject, rather than sending it', async () => {
    createMcpToken.mockClear();
    show();
    // pointerEventsCheck off: a disabled Joy button sets pointer-events: none, and
    // user-event would refuse the click before we learn whether anything was sent.
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    await waitFor(() => expect((field('Repository') as HTMLInputElement).value).toBe('getting-started'));

    await user.clear(field('Repository'));
    await user.type(field('Repository'), 'not a name');

    expect(screen.getByRole('button', { name: 'Issue' })).toHaveProperty('disabled', true);
    await user.click(screen.getByRole('button', { name: 'Issue' }));
    expect(createMcpToken).not.toHaveBeenCalled();
  });
});

describe('where to point the two things that have no browser', () => {
  test('shows the MCP endpoint and the SDLB upload API', () => {
    show();
    expect(screen.getByText(MCP)).toBeTruthy();
    expect(screen.getByText(UPLOAD)).toBeTruthy();
  });

  test('still tells an agent how to connect', () => {
    show();
    expect(screen.getByText(/mcpServers/)).toBeTruthy();
  });
});

describe('the global.uiBackend block', () => {
  const scope = { tenant: 'PrivateTenant', repo: 'getting-started', env: 'dev' };

  test('is wired to the repository and environment being named', () => {
    const hocon = uiBackendHocon(UPLOAD, scope);
    expect(hocon).toContain('global.uiBackend');
    expect(hocon).toContain('repo = getting-started');
    expect(hocon).toContain('env = dev');
  });

  test('carries a placeholder, because this snippet usually gets committed', () => {
    expect(uiBackendHocon(UPLOAD, scope)).toContain('###ENV#SDLB_UI_TOKEN###');
  });

  test('sets stagePath, without which a failed upload fails the whole job', () => {
    expect(uiBackendHocon(UPLOAD, scope)).toContain('stagePath');
  });
});

describe('what counts as a name', () => {
  // Mirrors NAME_REQUIRED in backend/src/routes/common.ts. The empty string is the
  // one that matters: the backend pattern ends in `*`, so it used to be accepted.
  test.each(['getting-started', 'dev', 'a_b-1', 'A', '0'])('%s is a name', (name) => {
    expect(isValidName(name)).toBe(true);
  });

  test.each(['', 'a b', 'a/b', 'a.b', 'x'.repeat(51)])('%s is not', (name) => {
    expect(isValidName(name)).toBe(false);
  });
});
