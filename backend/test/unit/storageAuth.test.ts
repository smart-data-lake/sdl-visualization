import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { resetSettings, settings } from '../../src/config.js';
import { blobEndpoint, resetCredential, storageCredential, tableEndpoint } from '../../src/store/credential.js';

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
    expect(settings().entityStore).toEqual({
      kind: 'azureTables',
      auth: { kind: 'connectionString', value: CONNECTION },
    });
  });

  test('an account name alone means the managed identity', () => {
    delete process.env.SDLB_STORAGE_CONNECTION_STRING;
    process.env.SDLB_STORAGE_ACCOUNT = 'sdlbacmestg';
    resetSettings();
    expect(settings().entityStore).toEqual({
      kind: 'azureTables',
      auth: { kind: 'identity', accountName: 'sdlbacmestg' },
    });
  });

  /**
   * The important one. If a leftover connection string could win, a deployment that
   * has been moved to an identity would keep using a key without anyone noticing -
   * and the whole point was that no key should exist.
   */
  test('the account name wins when both are set, rather than falling back to the key', () => {
    process.env.SDLB_STORAGE_ACCOUNT = 'sdlbacmestg';
    resetSettings();
    expect(settings().entityStore).toMatchObject({ auth: { kind: 'identity' } });
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

/**
 * Which backend each half of the store uses.
 *
 * The property that matters most is the first one: an Azure credential in the
 * environment is enough, so every existing deployment, local.settings.json and test
 * setup keeps working without being told about any of this.
 */
describe('choosing a backend', () => {
  const clear = () => {
    delete process.env.SDLB_STORAGE_BACKEND;
    delete process.env.SDLB_ENTITY_STORE;
    delete process.env.SDLB_BLOB_STORE;
    delete process.env.SDLB_SQLITE_FILE;
    delete process.env.SDLB_BLOB_ROOT;
    resetSettings();
  };
  beforeEach(clear);
  afterEach(clear);

  test('an Azure credential alone still means Azure, on both halves', () => {
    expect(settings().entityStore.kind).toBe('azureTables');
    expect(settings().blobStore.kind).toBe('azureBlob');
  });

  test('"local" switches both halves, under one directory', () => {
    process.env.SDLB_STORAGE_BACKEND = 'local';
    resetSettings();
    expect(settings().entityStore).toEqual({ kind: 'sqlite', file: '.sdlb-data/entities.db' });
    expect(settings().blobStore).toEqual({ kind: 'filesystem', root: '.sdlb-data/blobs' });
  });

  test('the two halves can be chosen separately', () => {
    process.env.SDLB_ENTITY_STORE = 'local';
    resetSettings();
    expect(settings().entityStore.kind).toBe('sqlite');
    expect(settings().blobStore.kind).toBe('azureBlob');
  });

  test('either path can be pointed elsewhere', () => {
    process.env.SDLB_STORAGE_BACKEND = 'local';
    process.env.SDLB_SQLITE_FILE = '/tmp/x.db';
    process.env.SDLB_BLOB_ROOT = '/tmp/blobs';
    resetSettings();
    expect(settings().entityStore).toEqual({ kind: 'sqlite', file: '/tmp/x.db' });
    expect(settings().blobStore).toEqual({ kind: 'filesystem', root: '/tmp/blobs' });
  });

  test('a name that is neither is refused rather than guessed at', () => {
    process.env.SDLB_STORAGE_BACKEND = 'postgres';
    resetSettings();
    expect(() => settings()).toThrow(/must be "azure" or "local"/);
  });

  /**
   * Deliberately not a fallback to the local backend. An instance that silently wrote to
   * a container filesystem and lost everything on restart is a worse failure than one
   * that refuses to start, so the local backend has to be asked for by name.
   */
  test('no credential and no backend named is still a configuration error', () => {
    delete process.env.SDLB_STORAGE_CONNECTION_STRING;
    delete process.env.SDLB_STORAGE_ACCOUNT;
    resetSettings();
    expect(() => settings()).toThrow(/SDLB_STORAGE_ACCOUNT/);
  });
});
