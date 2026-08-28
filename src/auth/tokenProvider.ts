import { AuthHeaders } from './types';

/**
 * The bridge between the React auth state and the fetchAPI implementations.
 *
 * fetchAPI classes are instantiated once, outside React, so they cannot read a
 * context. The auth provider registers a function here as it mounts, and the
 * fetcher asks for headers per request. Nothing is cached: the provider is the
 * one that knows whether its token is still valid.
 */

type HeaderProvider = () => Promise<AuthHeaders>;

let provider: HeaderProvider | undefined;

export function setAuthHeaderProvider(next: HeaderProvider | undefined): void {
  provider = next;
}

/** Empty when nobody is signed in, so an unauthenticated backend still works. */
export async function getAuthHeaders(): Promise<AuthHeaders> {
  if (!provider) return {};
  try {
    return await provider();
  } catch {
    // A request without credentials fails with a readable 401; a request that never
    // happens because the token refresh threw does not.
    return {};
  }
}
