import { settings } from '../config.js';
import { repositories } from '../store/repositories.js';
import type { Scope } from '../store/types.js';

/**
 * Live updates: a UI registers for a workflow, and an upload to that workflow publishes a
 * small notification for it to refetch on. Nothing is published for a workflow nobody watches.
 */

export interface RunChanged {
  type: 'runChanged';
  application: string;
  runId: number;
  attemptId: number;
}

export interface LiveDriver {
  /** A URL a browser connects to for the messages of one group, valid for `minutes`. */
  clientUrl(group: string, minutes: number, apiOrigin: string): Promise<string>;
  publish(group: string, message: RunChanged): Promise<void>;
}

/** The UI renews well before this, see fetchAPI_bundled.subscribeWorkflowUpdates. */
export const REGISTRATION_MINUTES = 30;
/** How long an instance believes nobody watches, before asking the store again. */
const UNWATCHED_CACHE_MS = 10_000;

/** Repo, env and workflow are \w and - only (routes/common.ts), so "." cannot collide. */
export const groupOf = (scope: Scope, workflow: string): string =>
  `wf.${scope.repo}.${scope.env}.${workflow}`;

let driverPromise: Promise<LiveDriver | undefined> | undefined;

// Imported lazily, like the store drivers, so an upload does not load an SDK it does not use.
function driver(): Promise<LiveDriver | undefined> {
  if (!driverPromise) driverPromise = buildDriver();
  return driverPromise;
}

async function buildDriver(): Promise<LiveDriver | undefined> {
  const config = settings().liveUpdates;
  switch (config.kind) {
    case 'none':
      return undefined;
    case 'sse': {
      const { sseDriver } = await import('./drivers/sse.js');
      return sseDriver;
    }
    case 'webpubsub': {
      const { createWebPubSubDriver } = await import('./drivers/webpubsub.js');
      return createWebPubSubDriver(config.endpoint, config.hub);
    }
  }
}

/** Per instance: until when a group is known to be watched, or since when known not to be. */
const known = new Map<string, { expiresAt?: number; checkedAt: number }>();

export async function registerLive(
  scope: Scope,
  workflow: string,
  apiOrigin: string,
): Promise<{ url: string; expiresAt: string } | { url: null }> {
  const live = await driver();
  if (!live) return { url: null };

  const group = groupOf(scope, workflow);
  const expiresAt = Date.now() + REGISTRATION_MINUTES * 60_000;
  await (await repositories()).live.register(scope, workflow, new Date(expiresAt).toISOString());
  known.set(group, { expiresAt, checkedAt: Date.now() });
  return {
    url: await live.clientUrl(group, REGISTRATION_MINUTES, apiOrigin),
    expiresAt: new Date(expiresAt).toISOString(),
  };
}

async function isWatched(scope: Scope, workflow: string, group: string): Promise<boolean> {
  const now = Date.now();
  const cached = known.get(group);
  if (cached?.expiresAt !== undefined && cached.expiresAt > now) return true;
  if (cached && cached.expiresAt === undefined && now - cached.checkedAt < UNWATCHED_CACHE_MS) return false;

  const stored = await (await repositories()).live.expiresAt(scope, workflow);
  const expiresAt = stored ? Date.parse(stored) : NaN;
  const watched = expiresAt > now;
  known.set(group, { expiresAt: watched ? expiresAt : undefined, checkedAt: now });
  return watched;
}

/** Never throws: a lost notification costs a click on refresh, a failed upload costs an SDLB job. */
export async function notifyRunChanged(
  scope: Scope,
  application: string,
  runId: number,
  attemptId: number,
): Promise<void> {
  try {
    const live = await driver();
    if (!live) return;
    const group = groupOf(scope, application);
    if (!(await isWatched(scope, application, group))) return;
    await live.publish(group, { type: 'runChanged', application, runId, attemptId });
  } catch (error) {
    console.warn('[live] could not publish a run notification', error);
  }
}

/** Only for tests, which change the environment between cases. */
export function resetNotifier(): void {
  driverPromise = undefined;
  known.clear();
}
