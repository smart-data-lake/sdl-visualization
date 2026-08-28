/**
 * Where the workspace navigation actually sends you.
 *
 * These paths name a place - a tenant, a repository, an environment - rather than a
 * step from wherever we happen to be, so they have to be absolute. React Router
 * treats a path with no leading slash as relative to the current one, so
 * `navigate(tenant)` from /PrivateTenant lands on /PrivateTenant/PrivateTenant and
 * keeps going: the home button walked down its own path a segment per click.
 *
 * The assertion is the property rather than the symptom - every target absolute -
 * because the same slip was in four places and would be again.
 */
import React from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, test, vi } from 'vitest';

const navigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router-dom')>()),
  useNavigate: () => navigate,
}));

// A manifest with auth is what puts the app in tenant-routed mode; without it there
// is no tenant in the URL and none of these paths exist.
vi.mock('../src/hooks/useManifest', () => ({
  useManifest: () => ({ data: { auth: { type: 'databricks' } } }),
}));

import { useWorkspace, WorkspaceProvider } from '../src/hooks/useWorkspace';

/** Render the provider at `pathname` and hand back the context it exposes. */
function workspaceAt(pathname: string) {
  let captured: ReturnType<typeof useWorkspace> | undefined;
  const Capture = () => {
    captured = useWorkspace();
    return null;
  };
  renderToString(
    <MemoryRouter initialEntries={[pathname]}>
      <WorkspaceProvider>
        <Capture />
      </WorkspaceProvider>
    </MemoryRouter>,
  );
  return captured!;
}

const targets = () => navigate.mock.calls.map(([to]) => to as string);

beforeEach(() => navigate.mockClear());

describe('workspace navigation', () => {
  test('the home button goes to the tenant, not below the current path', () => {
    // The reported bug: from /PrivateTenant this returned "PrivateTenant".
    workspaceAt('/PrivateTenant').navigateContent('');
    expect(targets()).toEqual(['/PrivateTenant']);
  });

  test('the home button is idempotent however deep it is pressed from', () => {
    for (const at of ['/PrivateTenant', '/PrivateTenant/PrivateTenant', '/PrivateTenant/settings/agents']) {
      navigate.mockClear();
      workspaceAt(at).navigateContent('');
      expect(targets(), `from ${at}`).toEqual(['/PrivateTenant']);
    }
  });

  test('every target is absolute, whichever way the workspace is changed', () => {
    const workspace = workspaceAt('/PrivateTenant/content/my-repo/prod');
    workspace.setTenant('OtherTenant');
    workspace.setRepo('other-repo');
    workspace.setRepo(undefined);
    workspace.setEnv('other-env');
    workspace.setEnv(undefined);
    workspace.navigateContent('workflows');

    expect(targets().length).toBe(6);
    for (const target of targets()) expect(target.startsWith('/'), target).toBe(true);
  });

  test('clearing the repository or environment still names the tenant', () => {
    const workspace = workspaceAt('/PrivateTenant/content/my-repo/prod');
    workspace.setRepo(undefined);
    expect(targets()).toEqual(['/PrivateTenant']);
  });

  test('navigateRel stays relative - that one is deliberate', () => {
    workspaceAt('/PrivateTenant/content/my-repo/prod/workflows').navigateRel('run.1/timeline');
    expect(targets()).toEqual(['/PrivateTenant/content/my-repo/prod/workflows/run.1/timeline']);
  });
});
