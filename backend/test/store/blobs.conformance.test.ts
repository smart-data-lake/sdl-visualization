import { beforeAll, describe, expect, test } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createAzureBlobStore } from '../../src/store/drivers/azureBlob.js';
import { createFilesystemBlobStore } from '../../src/store/drivers/filesystem.js';
import type { BlobStore } from '../../src/store/blobs.js';
import { blobPaths } from '../../src/store/blobs.js';
import { contentTypeOf } from '../../src/store/contentType.js';
import { TEST_CONNECTION_STRING } from '../setup/azurite.js';

/**
 * One contract, run against every blob driver. See the sibling entity suite for why
 * this shape rather than per-driver examples.
 */

interface Driver {
  name: string;
  create: () => BlobStore;
  /**
   * Whether an overwrite is atomic *in this environment*.
   *
   * Real Blob Storage guarantees it - uploadData on a blob under 256 MB is a single PUT,
   * so a reader sees the old body or the new one. Azurite does not: with the emulator
   * also busy elsewhere, downloadToBuffer returns a body that fails JSON.parse about once
   * per hundred reads. Measured, and reproducible outside the suite - quiet, the same
   * 12-writer race is clean; with a second blob being churned in parallel it tears.
   *
   * So the case below is skipped for the Azure driver rather than weakened for everyone.
   * It is the reason the filesystem driver writes to a temp file and renames, and there
   * it is checked.
   */
  atomicOverwrites: boolean;
}

const DRIVERS: Driver[] = [
  {
    name: 'azureBlob',
    create: () =>
      createAzureBlobStore({
        storage: { kind: 'connectionString', value: TEST_CONNECTION_STRING },
        container: 'conformance',
      }),
    atomicOverwrites: false,
  },
  {
    name: 'filesystem',
    create: () =>
      createFilesystemBlobStore({
        root: mkdtempSync(path.join(tmpdir(), 'sdlb-blobs-')),
      }),
    atomicOverwrites: true,
  },
];

let counter = 0;
/** A prefix of its own per case, so no case depends on what another left behind. */
const fresh = (): string => `c${++counter}-${process.pid}/`;

const utf8 = (s: string) => Buffer.from(s, 'utf8');

describe.each(DRIVERS)('$name', ({ create, atomicOverwrites }) => {
  let store: BlobStore;
  beforeAll(() => {
    store = create();
  });

  describe('reading and writing', () => {
    test('a buffer round-trips byte for byte', async () => {
      const at = `${fresh()}a.json`;
      const body = utf8('{"a":1}');
      await store.writeBuffer(at, body, 'application/json');
      expect(await store.readBuffer(at)).toEqual(body);
    });

    test('binary is not mangled - description images depend on this', async () => {
      const at = `${fresh()}img.png`;
      // A PNG header, including the bytes that a text round-trip would corrupt.
      const body = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0xff, 0xfe]);
      await store.writeBuffer(at, body, 'image/png');
      expect(await store.readBuffer(at)).toEqual(body);
    });

    test('a missing path reads as undefined rather than throwing', async () => {
      expect(await store.readBuffer(`${fresh()}absent.json`)).toBeUndefined();
    });

    test('a write replaces rather than merges', async () => {
      const at = `${fresh()}a.json`;
      await store.writeBuffer(at, utf8('{"a":1,"b":2}'), 'application/json');
      await store.writeBuffer(at, utf8('{"a":9}'), 'application/json');
      expect((await store.readBuffer(at))!.toString('utf8')).toBe('{"a":9}');
    });

    test('an empty body is a stored empty body, not an absent one', async () => {
      const at = `${fresh()}empty.txt`;
      await store.writeBuffer(at, Buffer.alloc(0), 'text/plain');
      expect(await store.readBuffer(at)).toEqual(Buffer.alloc(0));
    });
  });

  describe('listing', () => {
    test('names come back relative to the prefix, nested paths included', async () => {
      const prefix = fresh();
      await store.writeBuffer(`${prefix}a.md`, utf8('a'), 'text/markdown');
      await store.writeBuffer(`${prefix}images/b.png`, utf8('b'), 'image/png');

      const listed = await store.list(prefix);
      expect(listed.map((b) => b.name).sort()).toEqual(['a.md', 'images/b.png']);
    });

    test('a sibling prefix is not included', async () => {
      const base = fresh();
      await store.writeBuffer(`${base}wanted/a.md`, utf8('a'), 'text/markdown');
      await store.writeBuffer(`${base}other/b.md`, utf8('b'), 'text/markdown');
      expect((await store.list(`${base}wanted/`)).map((b) => b.name)).toEqual(['a.md']);
    });

    /**
     * A *string* prefix, not a path prefix. The only caller passes a slash-terminated
     * one, so a driver that treated the prefix as a directory would pass every other
     * case here and be wrong the first time somebody did not.
     */
    test('a partial segment matches as a string prefix', async () => {
      const base = fresh();
      await store.writeBuffer(`${base}prefix.md`, utf8('a'), 'text/markdown');
      await store.writeBuffer(`${base}other.md`, utf8('b'), 'text/markdown');
      expect((await store.list(`${base}pre`)).map((b) => b.name)).toEqual(['fix.md']);
    });

    test('nothing under a prefix is an empty list', async () => {
      expect(await store.list(fresh())).toEqual([]);
    });

    test('size is the exact byte length', async () => {
      const prefix = fresh();
      const body = utf8('日本語');
      await store.writeBuffer(`${prefix}a.txt`, body, 'text/plain');
      const [info] = await store.list(prefix);
      expect(info!.size).toBe(body.byteLength);
      expect(info!.size).toBe(9);
    });

    test('lastModified is a Date', async () => {
      const prefix = fresh();
      await store.writeBuffer(`${prefix}a.txt`, utf8('a'), 'text/plain');
      const [info] = await store.list(prefix);
      expect(info!.lastModified).toBeInstanceOf(Date);
      expect(Number.isNaN(info!.lastModified.getTime())).toBe(false);
    });

    /**
     * Only for writes whose content type agrees with the extension, which is every
     * write there is: putDescription derives it from the name, and writeJson always
     * writes application/json to a .json path. A driver with nowhere to record the type
     * derives it from the extension instead, so those two agree by construction - and
     * an extension-inconsistent write is the one case where they would not.
     */
    test('the content type of an extension-consistent write comes back', async () => {
      const prefix = fresh();
      for (const name of ['a.md', 'b.png', 'c.json', 'd.unknown']) {
        await store.writeBuffer(`${prefix}${name}`, utf8('x'), contentTypeOf(name));
      }
      const byName = new Map((await store.list(prefix)).map((b) => [b.name, b.contentType]));
      expect(byName.get('a.md')).toBe('text/markdown');
      expect(byName.get('b.png')).toBe('image/png');
      expect(byName.get('c.json')).toBe('application/json');
      expect(byName.get('d.unknown')).toBe('application/octet-stream');
    });
  });

  describe('removing', () => {
    test('remove reports whether it deleted anything', async () => {
      const at = `${fresh()}a.json`;
      await store.writeBuffer(at, utf8('{}'), 'application/json');
      expect(await store.remove(at)).toBe(true);
      expect(await store.remove(at)).toBe(false);
      expect(await store.readBuffer(at)).toBeUndefined();
    });

    test('a removed file leaves nothing behind in a listing', async () => {
      const prefix = fresh();
      await store.writeBuffer(`${prefix}deep/a.md`, utf8('a'), 'text/markdown');
      await store.remove(`${prefix}deep/a.md`);
      expect(await store.list(prefix)).toEqual([]);
    });
  });

  /**
   * Concurrent writes to one path, interleaved with reads. patchState is a
   * read-modify-write on a single blob and SDLB sends one PATCH per action while a run
   * is in flight, so a reader must never see a partial body - it would fail JSON.parse
   * and become a 500. Which write wins is not specified; that a reader always sees a
   * whole one is.
   */
  test.skipIf(!atomicOverwrites)('a concurrent reader never sees a torn write', async () => {
    const at = `${fresh()}state.json`;
    await store.writeBuffer(at, utf8(JSON.stringify({ n: 0 })), 'application/json');

    const writes = Array.from({ length: 12 }, (_, i) =>
      store.writeBuffer(at, utf8(JSON.stringify({ n: i + 1, pad: 'x'.repeat(i * 500) })), 'application/json'),
    );
    const reads = Array.from({ length: 24 }, async () => {
      const body = await store.readBuffer(at);
      expect(body).toBeDefined();
      expect(() => JSON.parse(body!.toString('utf8'))).not.toThrow();
    });
    await Promise.all([...writes, ...reads]);
  });

  /**
   * The guard lives in blobPaths, above the driver, so this holds for every driver
   * rather than only for the one where escaping the root would matter.
   */
  test('a path that would climb out of its prefix cannot be built at all', () => {
    const scope = { repo: 'r', env: 'e' };
    for (const bad of ['..', '.', '../x', 'a/b']) {
      expect(() => blobPaths.config(scope, bad)).toThrow();
      expect(() => blobPaths.descriptionsPrefix(scope, bad)).toThrow();
    }
  });
});
