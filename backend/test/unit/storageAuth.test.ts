import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { resetSettings, settings } from '../../src/config.js';
import { blobEndpoint, resetCredential, storageCredential, tableEndpoint, usesIdentity } from '../../src/store/credential.js';

/**
 * How storage is authenticated.
 *
 * The point of the managed-identity path is that the storage account can have
 * shared-key access switched off: an account-key connection string in an app setting
 * is a data-plane credential that works from anywhere the endpoint answers, so
 * removing the key matters more than hiding the endpoint. These tests pin the
 * resolution, because the failure mode is silent - a deployment that has been given
 * an identity quietly carrying on with a key nobody meant to leave behind.
 */

const CONNECTION = 'UseDevelopmentStorage=true';

beforeEach(() => {
  delete process.env.SDLB_STORAGE_ACCOUNT;
  process.env.SDLB_STORAGE_CONNECTION_STRING = CONNECTION;
  resetSettings();
  resetCredential();
});

afterEach(() => {
  delete process.env.SDLB_STORAGE_ACCOUNT;
  process.env.SDLB_STORAGE_CONNECTION_STRING = CONNECTION;
  resetSettings();
  resetCredential();
});

describe('choosing how to reach storage', () => {
  test('a connection string alone is used as such - Azurite has no Entra', () => {
    expect(settings().storage).toEqual({ kind: 'connectionString', value: CONNECTION });
    expect(usesIdentity()).toBe(false);
  });

  test('an account name alone means the managed identity', () => {
    delete process.env.SDLB_STORAGE_CONNECTION_STRING;
    process.env.SDLB_STORAGE_ACCOUNT = 'sdlbacmestg';
    resetSettings();
    expect(settings().storage).toEqual({ kind: 'identity', accountName: 'sdlbacmestg' });
    expect(usesIdentity()).toBe(true);
  });

  /**
   * The important one. If a leftover connection string could win, a deployment that
   * has been moved to an identity would keep using a key without anyone noticing -
   * and the whole point was that no key should exist.
   */
  test('the account name wins when both are set, rather than falling back to the key', () => {
    process.env.SDLB_STORAGE_ACCOUNT = 'sdlbacmestg';
    resetSettings();
    expect(settings().storage.kind).toBe('identity');
  });

  test('neither is a configuration error, not a silent default', () => {
    delete process.env.SDLB_STORAGE_CONNECTION_STRING;
    resetSettings();
    expect(() => settings()).toThrow(/SDLB_STORAGE_ACCOUNT/);
  });
});

describe('endpoints', () => {
  test('are derived from the account name over https', () => {
    expect(tableEndpoint('sdlbacmestg')).toBe('https://sdlbacmestg.table.core.windows.net');
    expect(blobEndpoint('sdlbacmestg')).toBe('https://sdlbacmestg.blob.core.windows.net');
  });
});

describe('the credential', () => {
  /**
   * @azure/identity is lazily imported so the local and test paths never load it.
   * That also means nothing would notice if it failed to resolve in the bundle until
   * a request arrived in Azure, so assert it loads and produces a credential.
   */
  test('loads and constructs, without needing a token', async () => {
    const credential = await storageCredential();
    expect(typeof credential.getToken).toBe('function');
  });

  test('is built once and reused', async () => {
    expect(await storageCredential()).toBe(await storageCredential());
  });
});
