import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildFastify } from '../../src/app.js';
import { useTempStore } from '../setup/store.js';
import { SEED_SCOPE, seedFixtures } from '../../scripts/seed-fixtures.js';
import { repositories } from '../../src/store/repositories.js';
import { resetNotifier } from '../../src/notify/index.js';

/** Live updates end to end on the sse driver: register, listen, upload, receive. */

let app: FastifyInstance;
let origin: string;
let store: Awaited<ReturnType<typeof useTempStore>>;
let run: { name: string; runId: number; attemptId: number };

const scope = { repo: SEED_SCOPE.repo, env: SEED_SCOPE.env };

beforeAll(async () => {
  store = await useTempStore();
  process.env.SDLB_LIVE_UPDATES = 'sse';
  app = await buildFastify();
  await seedFixtures(app);
  origin = await app.listen({ port: 0, host: '127.0.0.1' });
  const [workflow] = (await app.inject({ url: `/api/v1/workflows?${new URLSearchParams(SEED_SCOPE)}` })).json();
  const runs = (
    await app.inject({ url: `/api/v1/workflow?${new URLSearchParams({ ...SEED_SCOPE, application: workflow.name })}` })
  ).json();
  run = { name: workflow.name, runId: runs[0].runId, attemptId: runs[0].attemptId };
});

afterAll(async () => {
  delete process.env.SDLB_LIVE_UPDATES;
  await app?.close();
  await store?.cleanup();
});

async function register(application = run.name): Promise<{ url: string | null; expiresAt?: string }> {
  const query = new URLSearchParams({ ...SEED_SCOPE, application });
  const response = await app.inject({ method: 'POST', url: `/api/v1/live/register?${query}` });
  expect(response.statusCode, response.body).toBe(200);
  return response.json();
}

async function patchAction(): Promise<number> {
  const query = new URLSearchParams({
    ...SEED_SCOPE,
    application: run.name,
    runId: String(run.runId),
    attemptId: String(run.attemptId),
    actionId: 'live-test',
  });
  const response = await app.inject({ method: 'PATCH', url: `/api/v1/state?${query}`, payload: { state: 'RUNNING' } });
  return response.statusCode;
}

/** Collects the data lines of an event stream until closed. */
async function listen(url: string) {
  const controller = new AbortController();
  const response = await fetch(url, { signal: controller.signal });
  const events: unknown[] = [];
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  void (async () => {
    let buffer = '';
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) return;
        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split('\n\n');
        buffer = blocks.pop()!;
        for (const block of blocks) if (block.startsWith('data: ')) events.push(JSON.parse(block.slice(6)));
      }
    } catch {
      // aborted
    }
  })();
  return { response, events, close: () => controller.abort() };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 300));

describe('live updates', () => {
  test('an upload to a registered workflow reaches the listener as a notification only', async () => {
    const { url } = await register();
    const listener = await listen(url!.replace(/^https?:\/\/[^/]+/, origin));
    expect(listener.response.headers.get('content-type')).toBe('text/event-stream');

    expect(await patchAction()).toBe(200);
    await vi.waitFor(() => expect(listener.events).toHaveLength(1));
    expect(listener.events[0]).toEqual({ type: 'runChanged', application: run.name, runId: run.runId, attemptId: run.attemptId });
    listener.close();
  });

  test('nothing is published once the registration has expired', async () => {
    const { url } = await register();
    const listener = await listen(url!.replace(/^https?:\/\/[^/]+/, origin));
    await (await repositories()).live.register(scope, run.name, new Date(Date.now() - 1000).toISOString());
    resetNotifier(); // drops this instance's cache, as another instance would not have it

    expect(await patchAction()).toBe(200);
    await settle();
    expect(listener.events).toEqual([]);
    listener.close();
  });

  test('a tampered token is refused', async () => {
    const { url } = await register();
    const response = await fetch(url!.replace(/^https?:\/\/[^/]+/, origin).replace(/token=\d+/, 'token=1'));
    expect(response.status).toBe(401);
  });

  test('a failing notifier does not fail the upload', async () => {
    const live = (await repositories()).live;
    const spy = vi.spyOn(live, 'expiresAt').mockRejectedValue(new Error('store down'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    resetNotifier();
    expect(await patchAction()).toBe(200);
    expect(warn).toHaveBeenCalled();
    spy.mockRestore();
    warn.mockRestore();
  });

  test('without a driver, registering answers that there are no live updates', async () => {
    process.env.SDLB_LIVE_UPDATES = 'none';
    const { resetSettings } = await import('../../src/config.js');
    resetSettings();
    resetNotifier();
    expect(await register()).toEqual({ url: null });
    process.env.SDLB_LIVE_UPDATES = 'sse';
    resetSettings();
    resetNotifier();
  });
});
