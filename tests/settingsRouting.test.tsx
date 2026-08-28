/**
 * The settings navigation, which is rendered inside a splat route.
 *
 * Inside one, React Router resolves a relative `to` against the whole current
 * pathname rather than against the route's base - so `to="tokens"` meant
 * settings/tokens from the index and settings/tokens/tokens once already there.
 * The catch-all redirect had the same flaw, which is what made it unbounded: each
 * hop appended a segment, matched the catch-all again, and remounted the page,
 * refetching the token list every time.
 *
 * These assert the property that was missing rather than the symptom: wherever
 * under /settings we are, the nav points at the same place.
 */
import { renderToString } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, test, vi } from 'vitest';

// The Azure backend's shape: no user directory, but it does serve MCP.
vi.mock('../src/api/Fetcher', () => ({
  fetcher: () => ({ capabilities: () => ({ userManagement: false, mcpTokens: true }) }),
}));

// The pages themselves are not what is under test, and they want the workspace and
// query contexts the whole app supplies. What matters here is where the nav points.
vi.mock('../src/components/Settings/AccessTokens', () => ({ default: () => null }));
vi.mock('../src/components/Settings/Users', () => ({ default: () => null }));

import Setting from '../src/components/Settings/Setting';

function navTargetsAt(pathname: string): string[] {
  const html = renderToString(
    <MemoryRouter initialEntries={[pathname]}>
      <Routes>
        <Route path=":tenant/settings/*" element={<Setting />} />
      </Routes>
    </MemoryRouter>,
  );
  return [...html.matchAll(/href="([^"]*)"/g)].map((match) => match[1]);
}

const TOKENS = '/PrivateTenant/settings/tokens';

describe('settings navigation', () => {
  test('points at the same place from the settings index', () => {
    expect(navTargetsAt('/PrivateTenant/settings')).toEqual([TOKENS]);
  });

  test('points at the same place from the page it links to', () => {
    // The click that used to append: already on agents, the link must not grow.
    expect(navTargetsAt(TOKENS)).toEqual([TOKENS]);
  });

  test('recovers from an already-doubled path instead of extending it', () => {
    expect(navTargetsAt(`${TOKENS}/tokens`)).toEqual([TOKENS]);
    expect(navTargetsAt(`${TOKENS}/tokens/tokens`)).toEqual([TOKENS]);
  });
});
