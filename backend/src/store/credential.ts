import type { TokenCredential } from '@azure/core-auth';
import { settings } from '../config.js';

/**
 * How the storage clients authenticate.
 *
 * In Azure it is the app's managed identity, so the storage account can have
 * shared-key access switched off: with no key in existence, a leaked app setting is
 * not a data-plane credential, and reaching the endpoint is not the same as being
 * able to read it. Locally it is a connection string, because Azurite has no Entra
 * to authenticate against.
 *
 * `@azure/identity` is imported lazily and memoised. It is a heavy dependency, and
 * the local and test paths never need it - loading it on every start would put it on
 * the cold-start path for nothing.
 */

let credentialPromise: Promise<TokenCredential> | undefined;

export function storageCredential(): Promise<TokenCredential> {
  if (!credentialPromise) {
    credentialPromise = import('@azure/identity').then(
      // DefaultAzureCredential rather than ManagedIdentityCredential, so the same
      // code works under `az login` when someone seeds or debugs a real account.
      ({ DefaultAzureCredential }) => new DefaultAzureCredential(),
    );
  }
  return credentialPromise;
}

/** Only for tests, which change the environment between cases. */
export function resetCredential(): void {
  credentialPromise = undefined;
}

export const tableEndpoint = (account: string) => `https://${account}.table.core.windows.net`;
export const blobEndpoint = (account: string) => `https://${account}.blob.core.windows.net`;

/** True when storage is reached with the managed identity rather than a key. */
export function usesIdentity(): boolean {
  return settings().storage.kind === 'identity';
}
