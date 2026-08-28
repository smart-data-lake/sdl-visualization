/**
 * The Access Token page.
 *
 * One token authenticates both things that reach the backend without a browser, so
 * the page has to show both places to point at - the MCP endpoint and the upload
 * API - rather than only the one it used to be named after.
 */
import { renderToString } from 'react-dom/server';
import { describe, expect, test, vi } from 'vitest';

const MCP = 'https://sdlb-demo-funcapp.azurewebsites.net/mcp/getting-started/dev';
const UPLOAD = 'https://sdlb-demo-funcapp.azurewebsites.net/api/v1';

vi.mock('../src/hooks/useWorkspace', () => ({
  useWorkspace: () => ({ tenant: 'PrivateTenant', repo: 'getting-started', env: 'dev' }),
}));

vi.mock('../src/api/Fetcher', () => ({
  fetcher: () => ({
    capabilities: () => ({ userManagement: false, mcpTokens: true }),
    mcpUrl: () => MCP,
    uploadUrl: () => UPLOAD,
    listMcpTokens: async () => [],
    createMcpToken: async () => ({ id: 'x', label: 'l', email: 'e', createdAt: '', token: 't' }),
    revokeMcpToken: async () => undefined,
  }),
}));

import AccessTokens from '../src/components/Settings/AccessTokens';

const page = () => renderToString(<AccessTokens />);

describe('the access token page', () => {
  test('shows the MCP endpoint', () => {
    expect(page()).toContain(MCP);
  });

  test('shows the SDLB upload API', () => {
    expect(page()).toContain(UPLOAD);
  });

  test('offers a global.uiBackend block wired to this repository and environment', () => {
    const html = page();
    expect(html).toContain('global.uiBackend');
    expect(html).toContain('repo = getting-started');
    expect(html).toContain('env = dev');
    // The token belongs in the environment, not in a file that gets committed.
    expect(html).toContain('###ENV#SDLB_UI_TOKEN###');
    // Without stagePath a failed upload fails the job, which is worth saying here.
    expect(html).toContain('stagePath');
  });

  test('still tells an agent how to connect', () => {
    expect(page()).toContain('mcpServers');
  });
});
