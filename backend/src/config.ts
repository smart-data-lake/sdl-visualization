/**
 * Application settings, read once from the environment.
 *
 * Everything the service is configured with lives here, so the Function app
 * settings are the only place deployments differ. Names are prefixed SDLB_ to
 * keep them apart from the runtime's own settings.
 */

function optional(name: string, fallback: string): string {
  return process.env[name] || fallback;
}

/** How callers are authenticated. "disabled" is for local development and the e2e suite. */
export type AuthMode = 'databricks' | 'disabled';

export interface Settings {
  /**
   * How storage is reached. A connection string carries an account key, which is a
   * data-plane credential that works from anywhere the endpoint is reachable - so in
   * Azure the account name plus the app's managed identity is used instead, and the
   * account has shared-key access switched off entirely. The connection string
   * remains for Azurite, which has no Entra to authenticate against.
   */
  storage: { kind: 'identity'; accountName: string } | { kind: 'connectionString'; value: string };
  blobContainer: string;
  /** The single tenant this deployment serves. Reported by GET /tenants, and otherwise ignored. */
  tenantName: string;
  authMode: AuthMode;
  /** Full https origins of the Databricks workspaces whose users may use this deployment. */
  databricksHosts: string[];
  authCacheTtlMs: number;
}

let _settings: Settings | undefined;

export function settings(): Settings {
  if (!_settings) _settings = readSettings();
  return _settings;
}

/** Only for tests, which change the environment between cases. */
export function resetSettings(): void {
  _settings = undefined;
}

function readStorage(): Settings['storage'] {
  const accountName = process.env.SDLB_STORAGE_ACCOUNT;
  const connectionString = process.env.SDLB_STORAGE_CONNECTION_STRING;

  // The account name wins: a deployment that has been given an identity should not
  // silently fall back to a key because one was left in the settings.
  if (accountName) return { kind: 'identity', accountName };
  if (connectionString) return { kind: 'connectionString', value: connectionString };
  throw new Error('Set SDLB_STORAGE_ACCOUNT (preferred) or SDLB_STORAGE_CONNECTION_STRING');
}

function readSettings(): Settings {
  const authMode = optional('SDLB_AUTH_MODE', 'databricks') as AuthMode;
  if (authMode !== 'databricks' && authMode !== 'disabled') {
    throw new Error(`SDLB_AUTH_MODE must be "databricks" or "disabled", got "${authMode}"`);
  }
  return {
    storage: readStorage(),
    blobContainer: optional('SDLB_BLOB_CONTAINER', 'sdlb'),
    tenantName: optional('SDLB_TENANT_NAME', 'PrivateTenant'),
    authMode,
    databricksHosts: optional('SDLB_DATABRICKS_HOSTS', '')
      .split(',')
      .map((h) => h.trim().toLowerCase().replace(/\/$/, ''))
      .filter((h) => h.length > 0),
    authCacheTtlMs: Number(optional('SDLB_AUTH_CACHE_TTL_SECONDS', '300')) * 1000,
  };
}
