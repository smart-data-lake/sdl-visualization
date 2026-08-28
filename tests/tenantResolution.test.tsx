/**
 * Settling which tenant is in effect.
 *
 * The SPA used to invent the name - `urlTenant || "PrivateTenant"` in useWorkspace -
 * so a deployment that set tenant_name to anything else was ignored, and a tenant that
 * did not exist rendered the "seems still empty" onboarding page as though it did.
 * The name now comes from GET /tenants, and an unknown one is an error.
 *
 * WorkspaceSpinner is the whole decision, so these drive it directly.
 */
import { renderToString } from 'react-dom/server';
import { beforeEach, describe, expect, test, vi } from 'vitest';

// renderToString runs no effects, so a real <Navigate> would be invisible. Render the
// target instead, which is the thing worth asserting on.
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router-dom')>()),
  Navigate: ({ to, replace }: { to: string; replace?: boolean }) => (
    <span data-navigate={to} data-replace={String(!!replace)} />
  ),
  useNavigate: () => vi.fn(),
}));

vi.mock('../src/components/Common/CenteredCircularProgress', () => ({
  default: () => <span data-spinner="" />,
}));

vi.mock('../src/hooks/useManifest', () => ({
  useManifest: () => ({ data: state.manifest, isFetching: false }),
}));

vi.mock('../src/hooks/useWorkspace', () => ({
  useWorkspace: () => ({ tenant: state.tenant, repo: undefined, env: undefined }),
}));

vi.mock('../src/hooks/useFetchData', () => ({
  useFetchTenants: () => ({ data: state.tenants, isFetching: state.fetching }),
  useFetchRepos: () => ({ data: [], isFetching: false }),
  useFetchEnvs: () => ({ data: [], isFetching: false }),
}));

const AUTH_MANIFEST = { auth: { type: 'databricks' }, backendConfig: 'azure;https://x/api/v1' };

const state: {
  manifest: any;
  tenant: string | undefined;
  tenants: string[] | undefined;
  fetching: boolean;
} = { manifest: AUTH_MANIFEST, tenant: undefined, tenants: undefined, fetching: false };

beforeEach(() => {
  state.manifest = AUTH_MANIFEST;
  state.tenant = undefined;
  state.tenants = undefined;
  state.fetching = false;
});

import RootLayoutSpinner from '../src/layouts/RootLayoutSpinner';

const render = () => renderToString(<RootLayoutSpinner><span data-page="" /></RootLayoutSpinner>);

describe('resolving the tenant', () => {
  test('adopts the name the backend reports, whatever it is', () => {
    // The case that fails today: a deployment whose tenant_name is not "PrivateTenant".
    state.tenants = ['acme'];
    expect(render()).toContain('data-navigate="/acme"');
  });

  test('replaces rather than pushes, so Back does not bounce', () => {
    state.tenants = ['acme'];
    expect(render()).toContain('data-replace="true"');
  });

  test('a tenant that does not exist is an error, not an empty workspace', () => {
    state.tenants = ['acme'];
    state.tenant = 'xyz';
    const html = render();
    expect(html).toContain('does not exist');
    expect(html).toContain('xyz');
    expect(html).toContain('Go to home');
    // The onboarding guide is advice for a real but empty tenant, and misleading here.
    expect(html).not.toContain('seems still empty');
    expect(html).not.toContain('data-page');
  });

  test('a tenant that exists renders the page', () => {
    state.tenants = ['acme'];
    state.tenant = 'acme';
    const html = render();
    expect(html).toContain('data-page');
    expect(html).not.toContain('does not exist');
  });

  test('while the list is loading, neither the page nor the error shows', () => {
    state.fetching = true;
    state.tenant = 'xyz';
    const html = render();
    expect(html).toContain('data-spinner');
    expect(html).not.toContain('does not exist');
  });

  /*
    The trap. useFetchTenants is disabled until authenticated, so signed out it never
    runs: isFetching false, data undefined. The login screen renders through this
    component, so treating "no list" as "no such tenant" would cover the sign-in page
    with an error and lock everyone out.
  */
  test('no list yet means carry on, not "no such tenant"', () => {
    state.tenants = undefined;
    state.tenant = 'xyz';
    const html = render();
    expect(html).toContain('data-page');
    expect(html).not.toContain('does not exist');
    expect(html).not.toContain('data-navigate');
  });

  test('an empty list is treated the same way - a failed read is not a verdict', () => {
    state.tenants = [];
    state.tenant = 'xyz';
    expect(render()).toContain('data-page');
  });

  test('a blank tenant name cannot become a redirect to "/", which would loop', () => {
    state.tenants = [''];
    expect(render()).not.toContain('data-navigate');
  });

  test('a deployment without auth is untouched', () => {
    state.manifest = { backendConfig: 'local;' };
    state.tenant = undefined;
    const html = render();
    expect(html).toContain('data-page');
    expect(html).not.toContain('data-navigate');
  });
});
