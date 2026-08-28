/**
 * Databricks user-to-machine login: OAuth 2.1 authorization code with PKCE, against
 * the workspace itself as the authorization server.
 *
 * The workspace is the issuer, so there is one endpoint set per workspace and the
 * user picks which workspace to sign in to. The app is registered in the Databricks
 * account console as a custom OAuth app and is a *public* client - a browser cannot
 * keep a secret - which is exactly what PKCE is for.
 *
 * The redirect comes back to the app's own base URL with the code in the query
 * string. That is deliberate: this app uses a hash router, so the query part is the
 * only place the router will not eat, and it is stripped as soon as it is consumed.
 */

const STORAGE_KEY = 'sdlb.databricks.session';
const PENDING_KEY = 'sdlb.databricks.pending';

/** Refresh this far ahead of expiry, so a request never races the clock. */
const REFRESH_MARGIN_MS = 120_000;

export interface DatabricksAuthConfig {
  clientId: string;
  /** Workspaces the user may sign in to. The first is the default. */
  workspaceHosts: string[];
  /** Defaults to what the API and the refresh flow need. */
  scopes?: string;
  /**
   * Base URL of this deployment's backend, e.g. https://x.azurewebsites.net/api/v1.
   * Not part of manifest.auth - AuthProvider derives it from backendConfig, because
   * the token exchange has to go through the backend. See redeem().
   */
  apiBaseUrl?: string;
}

export interface DatabricksSession {
  workspaceHost: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  email?: string;
}

interface PendingLogin {
  workspaceHost: string;
  verifier: string;
  state: string;
  redirectUri: string;
}

/*
  The narrowest set that covers what this app actually does.

  `all-apis` was here first and is what the workspace offers most prominently, but it
  is every API the signed-in user can reach - a wide thing to hand a browser for a
  viewer. The workspace advertises fine-grained scopes (see
  <workspace>/oidc/.well-known/openid-configuration, `scopes_supported`), so:

  - `scim`           the one API the backend calls. Every request is authenticated by
                     GET /api/2.0/preview/scim/v2/Me on the workspace, which is where
                     the caller's email and groups come from - backend/src/auth/databricks.ts.
  - `offline_access` the refresh token. Without it the session dies with the access
                     token and the user is sent back to the workspace every hour.
  - `openid email`   the id token, which is only read to display who is signed in
                     (emailFromIdToken below). `profile` adds nothing this app uses.

  Whatever is set here has to be assigned to the OAuth app connection as well, or the
  workspace refuses the login with "Scopes '<x>' are not assigned to the client".
  Override per deployment with manifest.auth.scopes.
*/
const DEFAULT_SCOPES = 'scim offline_access openid email';

export function readSession(): DatabricksSession | undefined {
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as DatabricksSession;
  } catch {
    sessionStorage.removeItem(STORAGE_KEY);
    return undefined;
  }
}

function writeSession(session: DatabricksSession | undefined): void {
  if (session) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  else sessionStorage.removeItem(STORAGE_KEY);
}

export function signOut(): void {
  writeSession(undefined);
  sessionStorage.removeItem(PENDING_KEY);
}

/** The app's own URL without query or hash - where the workspace sends the user back. */
export function redirectUri(): string {
  return `${window.location.origin}${window.location.pathname}`;
}

export async function beginLogin(config: DatabricksAuthConfig, workspaceHost: string): Promise<void> {
  const verifier = randomString(64);
  const state = randomString(24);
  const pending: PendingLogin = { workspaceHost, verifier, state, redirectUri: redirectUri() };
  sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending));

  const params = new URLSearchParams({
    client_id: config.clientId,
    response_type: 'code',
    redirect_uri: pending.redirectUri,
    scope: config.scopes ?? DEFAULT_SCOPES,
    state,
    code_challenge: await codeChallenge(verifier),
    code_challenge_method: 'S256',
  });
  window.location.assign(`${workspaceHost}/oidc/v1/authorize?${params}`);
}

/** True when the current URL is a redirect back from the workspace. */
export function hasAuthorizationCode(): boolean {
  const params = new URLSearchParams(window.location.search);
  return params.has('code') || params.has('error');
}

/**
 * Finish a login that is coming back in the URL, and clean the query away so a
 * reload does not try to redeem the same code twice.
 */
export async function completeLogin(config: DatabricksAuthConfig): Promise<DatabricksSession> {
  const params = new URLSearchParams(window.location.search);
  const pendingRaw = sessionStorage.getItem(PENDING_KEY);
  stripQuery();

  const error = params.get('error');
  if (error) throw new Error(`${error}: ${params.get('error_description') ?? 'login was refused'}`);
  if (!pendingRaw) throw new Error('No login was in progress in this tab');

  const pending = JSON.parse(pendingRaw) as PendingLogin;
  sessionStorage.removeItem(PENDING_KEY);

  if (params.get('state') !== pending.state) throw new Error('Login state did not match');
  const code = params.get('code');
  if (!code) throw new Error('The workspace returned no authorization code');

  const session = await redeem(config, 'token', pending.workspaceHost, {
    code,
    redirectUri: pending.redirectUri,
    codeVerifier: pending.verifier,
  });
  writeSession(session);
  return session;
}

/**
 * A valid access token, refreshing it first if it is about to expire.
 * Returns undefined when nobody is signed in, or when the refresh no longer works -
 * which is the signal to show the login screen again.
 */
export async function currentAccessToken(
  config: DatabricksAuthConfig,
): Promise<DatabricksSession | undefined> {
  const session = readSession();
  if (!session) return undefined;
  if (session.expiresAt - REFRESH_MARGIN_MS > Date.now()) return session;
  if (!session.refreshToken) {
    signOut();
    return undefined;
  }

  try {
    const refreshed = await redeem(config, 'refresh', session.workspaceHost, {
      refreshToken: session.refreshToken,
    });
    // A refresh response may omit the refresh token, meaning "keep the one you have".
    const next = { ...refreshed, refreshToken: refreshed.refreshToken ?? session.refreshToken };
    writeSession(next);
    return next;
  } catch {
    signOut();
    return undefined;
  }
}

/**
 * Turn a code or a refresh token into a session, via this deployment's backend.
 *
 * Not directly against the workspace, which is where this obviously belongs: its
 * /oidc/v1/token sends no Access-Control-Allow-Origin and does not answer preflight,
 * so the browser posts the request, the workspace processes it, and the response is
 * then withheld from this code. The authorize step is a top-level redirect and is
 * unaffected, so the failure only ever shows up here, one step from the end.
 *
 * The backend relays it server-side, where CORS does not apply, and hands back the
 * workspace's own status and body - so an "invalid_grant" still reads as one.
 */
async function redeem(
  config: DatabricksAuthConfig,
  path: 'token' | 'refresh',
  workspaceHost: string,
  body: Record<string, string>,
): Promise<DatabricksSession> {
  if (!config.apiBaseUrl) {
    throw new Error('No backend is configured to exchange the Databricks code with');
  }
  const response = await fetch(`${config.apiBaseUrl}/auth/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workspaceHost, clientId: config.clientId, ...body }),
  });
  const json = await response.json().catch(() => undefined);
  if (!response.ok) {
    const detail = json?.error_description ?? json?.message ?? json?.detail ?? response.statusText;
    throw new Error(`Databricks refused the token request (${response.status}): ${detail}`);
  }
  return {
    workspaceHost,
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
    email: emailFromIdToken(json.id_token),
  };
}

/**
 * The signed-in user's email, for the header. Read from the id token without
 * verifying it - the backend verifies the access token against the workspace, and
 * this value is only ever displayed.
 */
function emailFromIdToken(idToken?: string): string | undefined {
  if (!idToken) return undefined;
  try {
    const [, payload] = idToken.split('.');
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return json.email ?? json.preferred_username ?? json.sub;
  } catch {
    return undefined;
  }
}

function stripQuery(): void {
  window.history.replaceState({}, '', `${window.location.pathname}${window.location.hash}`);
}

function randomString(bytes: number): string {
  const buffer = new Uint8Array(bytes);
  crypto.getRandomValues(buffer);
  return base64Url(buffer);
}

async function codeChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64Url(new Uint8Array(digest));
}

function base64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
