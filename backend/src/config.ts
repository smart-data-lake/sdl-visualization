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

/**
 * How the Azure storage clients authenticate.
 *
 * A connection string carries an account key, which is a data-plane credential that
 * works from anywhere the endpoint is reachable - so in Azure the account name plus the
 * app's managed identity is used instead, and the account has shared-key access switched
 * off entirely. The connection string remains for Azurite, which has no Entra to
 * authenticate against.
 */
export type AzureStorageAuth =
  | { kind: 'identity'; accountName: string }
  | { kind: 'connectionString'; value: string };

/** Where indexed records go. */
export type EntityStoreConfig =
  | { kind: 'azureTables'; auth: AzureStorageAuth }
  | { kind: 'sqlite'; file: string };

/** Where files and large payloads go. */
export type BlobStoreConfig =
  | { kind: 'azureBlob'; auth: AzureStorageAuth; container: string }
  | { kind: 'filesystem'; root: string };

export interface Settings {
  /**
   * The two stores are chosen independently, because they are independent: the code has
   * two facades, and a single enum would need a name invented for every combination
   * anyone later wanted. SDLB_STORAGE_BACKEND sets both at once for the two that matter.
   */
  entityStore: EntityStoreConfig;
  blobStore: BlobStoreConfig;
  /** The single tenant this deployment serves. Reported by GET /tenants, and otherwise ignored. */
  tenantName: string;
  authMode: AuthMode;
  /** Full https origins of the Databricks workspaces whose users may use this deployment. */
  databricksHosts: string[];
  authCacheTtlMs: number;
  /**
   * Requests per minute, per address, *per instance*, on the routes that cannot be
   * authenticated. The deployment-wide ceiling is this times the instance count -
   * see routes/rateLimit.ts.
   */
  authRateLimitPerMinute: number;
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

type Backend = 'azure' | 'local';

function azureAuth(): AzureStorageAuth {
  const accountName = process.env.SDLB_STORAGE_ACCOUNT;
  const connectionString = process.env.SDLB_STORAGE_CONNECTION_STRING;

  // The account name wins: a deployment that has been given an identity should not
  // silently fall back to a key because one was left in the settings.
  if (accountName) return { kind: 'identity', accountName };
  if (connectionString) return { kind: 'connectionString', value: connectionString };
  throw new Error('Set SDLB_STORAGE_ACCOUNT (preferred) or SDLB_STORAGE_CONNECTION_STRING');
}

/**
 * Which backend each half of the store uses.
 *
 * With nothing set, an Azure credential in the environment means Azure - so every
 * existing deployment, local.settings.json and test setup keeps working untouched.
 *
 * With nothing set *and* no credential, this throws. It deliberately does not fall back
 * to the local backend: an instance that silently wrote to a container filesystem and
 * lost everything on restart is a worse failure than one that refuses to start. Getting
 * the local backend requires asking for it by name.
 */
function readBackend(name: string, fallback: Backend | undefined): Backend {
  const value = process.env[name] ?? process.env.SDLB_STORAGE_BACKEND ?? fallback;
  if (value === undefined) return 'azure'; // azureAuth() then reports what is missing
  if (value !== 'azure' && value !== 'local') {
    throw new Error(`${name} must be "azure" or "local", got "${String(value)}"`);
  }
  return value;
}

function inferredBackend(): Backend | undefined {
  return process.env.SDLB_STORAGE_ACCOUNT || process.env.SDLB_STORAGE_CONNECTION_STRING
    ? 'azure'
    : undefined;
}

/** Both halves of the local backend live under one directory, so there is one path to clear. */
const DEFAULT_DATA_DIR = '.sdlb-data';

function readEntityStore(): EntityStoreConfig {
  if (readBackend('SDLB_ENTITY_STORE', inferredBackend()) === 'local') {
    return {
      kind: 'sqlite',
      file: optional('SDLB_SQLITE_FILE', `${DEFAULT_DATA_DIR}/entities.db`),
    };
  }
  return { kind: 'azureTables', auth: azureAuth() };
}

function readBlobStore(): BlobStoreConfig {
  if (readBackend('SDLB_BLOB_STORE', inferredBackend()) === 'local') {
    return { kind: 'filesystem', root: optional('SDLB_BLOB_ROOT', `${DEFAULT_DATA_DIR}/blobs`) };
  }
  return {
    kind: 'azureBlob',
    auth: azureAuth(),
    container: optional('SDLB_BLOB_CONTAINER', 'sdlb'),
  };
}

function readSettings(): Settings {
  const authMode = optional('SDLB_AUTH_MODE', 'databricks') as AuthMode;
  if (authMode !== 'databricks' && authMode !== 'disabled') {
    throw new Error(`SDLB_AUTH_MODE must be "databricks" or "disabled", got "${authMode}"`);
  }
  return {
    entityStore: readEntityStore(),
    blobStore: readBlobStore(),
    tenantName: optional('SDLB_TENANT_NAME', 'PrivateTenant'),
    authMode,
    databricksHosts: optional('SDLB_DATABRICKS_HOSTS', '')
      .split(',')
      .map((h) => h.trim().toLowerCase().replace(/\/$/, ''))
      .filter((h) => h.length > 0),
    authCacheTtlMs: Number(optional('SDLB_AUTH_CACHE_TTL_SECONDS', '300')) * 1000,
    authRateLimitPerMinute: Number(optional('SDLB_AUTH_RATE_LIMIT_PER_MINUTE', '10')),
  };
}
