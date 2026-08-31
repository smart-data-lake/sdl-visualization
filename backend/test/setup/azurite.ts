import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

/**
 * Start a throwaway Azurite for the test run.
 *
 * On ports of its own, so it never collides with the one a developer is running
 * for `yarn seed`, and in a temporary directory, so every run starts from an empty
 * store and no test can depend on what a previous one left behind.
 *
 * --skipApiVersionCheck is required: the Azure SDKs speak a newer REST version than
 * the emulator recognises, and without it every request fails with a 400.
 */

const BLOB_PORT = 10100;
const QUEUE_PORT = 10101;
const TABLE_PORT = 10102;

const ACCOUNT = 'devstoreaccount1';
const KEY =
  'Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==';

export const TEST_CONNECTION_STRING = [
  'DefaultEndpointsProtocol=http',
  `AccountName=${ACCOUNT}`,
  `AccountKey=${KEY}`,
  `BlobEndpoint=http://127.0.0.1:${BLOB_PORT}/${ACCOUNT}`,
  `QueueEndpoint=http://127.0.0.1:${QUEUE_PORT}/${ACCOUNT}`,
  `TableEndpoint=http://127.0.0.1:${TABLE_PORT}/${ACCOUNT}`,
  '',
].join(';');

let azurite: ChildProcess | undefined;
let location: string | undefined;

export async function setup(): Promise<void> {
  process.env.SDLB_STORAGE_CONNECTION_STRING = TEST_CONNECTION_STRING;
  process.env.SDLB_AUTH_MODE = 'disabled';
  process.env.SDLB_LOG_LEVEL = 'error';
  process.env.SDLB_BLOB_CONTAINER = 'sdlb';

  /*
    Refuse to run if something already holds the ports. waitForPort below only checks
    that a port answers, so a leftover emulator - one whose process outlived the run that
    spawned it - is adopted silently: the freshly spawned Azurite fails to bind, every
    suite talks to the old store instead, and the run inherits whatever the previous one
    left behind. That surfaces as an unrelated assertion failing, because the suites are
    not written to tolerate pre-existing data. auth.test.ts is the one that notices,
    since it asserts a workspace has no row before a later case gives it one.
  */
  const ports = [BLOB_PORT, QUEUE_PORT, TABLE_PORT];
  const busy = await Promise.all(ports.map(isOpen));
  const occupied = ports.filter((_, i) => busy[i]);
  if (occupied.length > 0) {
    throw new Error(
      `Something is already listening on ${occupied.join(', ')}, which is where the test ` +
        `Azurite goes. That is usually an emulator left behind by an earlier run, and the ` +
        `suite would silently share its store. Kill it and try again.`,
    );
  }

  location = await mkdtemp(path.join(tmpdir(), 'sdlb-azurite-'));
  azurite = spawn(
    process.execPath,
    [
      require.resolve('azurite/dist/src/azurite.js'),
      '--silent',
      '--skipApiVersionCheck',
      '--location',
      location,
      '--blobPort',
      String(BLOB_PORT),
      '--queuePort',
      String(QUEUE_PORT),
      '--tablePort',
      String(TABLE_PORT),
    ],
    { stdio: 'ignore' },
  );

  await Promise.all([waitForPort(BLOB_PORT), waitForPort(TABLE_PORT)]);
}

export async function teardown(): Promise<void> {
  /*
    Wait for Azurite to actually be gone before removing its directory. `kill()`
    only sends the signal, and Azurite goes on flushing its extent files while it
    shuts down - so the removal races it and rmdir fails with ENOTEMPTY, after every
    test has already passed. SIGKILL as a backstop, so a wedged emulator cannot hang
    the run instead.
  */
  if (azurite && azurite.exitCode === null && azurite.signalCode === null) {
    const exited = new Promise<void>((resolve) => azurite?.once('exit', () => resolve()));
    azurite.kill();
    const force = setTimeout(() => azurite?.kill('SIGKILL'), 5_000);
    await exited;
    clearTimeout(force);
  }
  if (location) await rm(location, { recursive: true, force: true, maxRetries: 3 });
}

async function waitForPort(port: number, timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (await isOpen(port)) return;
    if (Date.now() > deadline) throw new Error(`Azurite did not open port ${port} in time`);
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}

function isOpen(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: '127.0.0.1' });
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => {
      socket.destroy();
      resolve(false);
    });
  });
}
