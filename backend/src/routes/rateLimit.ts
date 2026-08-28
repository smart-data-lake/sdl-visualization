import type { FastifyReply, FastifyRequest } from 'fastify';
import { stripPort } from '../azure/bridge.js';
import { HttpError } from '../errors.js';

/**
 * A fixed-window request limit, per key, held in memory.
 *
 * For the routes that cannot be authenticated - the OAuth relay, which is where a
 * stranger can make this service call Databricks on their behalf. The host allowlist
 * already decides *which* workspace can be reached; this decides how often.
 *
 * In memory, and therefore **per instance, per address**. That is not a detail:
 * Flex Consumption spreads even strictly sequential requests across instances -
 * measured here, 42 requests landed on five of them - so the ceiling a caller
 * actually meets is this limit times maximum_instance_count, not this limit. Pick
 * the number with that multiplication in mind.
 *
 * It stays in memory because the alternative is a shared store: Redis, or a table
 * write on every request. What is being prevented is a stranger generating traffic
 * through us, not a stranger getting in - the host allowlist and the workspace do
 * that - and a bounded multiple of a small number is a sufficient brake for it. The
 * identity cache in auth/databricks.ts is per instance for the same reason. If an
 * exact global limit is ever needed, the tables are already there to hold it.
 *
 * Generous relative to a person, who signs in once and refreshes about hourly, and
 * who shares an address with a whole office behind NAT. Ungenerous relative to a
 * script, which is the point.
 */

interface Window {
  count: number;
  resetAt: number;
}

/**
 * Above this many tracked keys the map is swept. It only exists so that a stream of
 * one-request-each addresses cannot grow it without bound; the windows are short, so
 * almost everything in it is usually expired.
 */
const MAX_KEYS = 10_000;

export interface Verdict {
  allowed: boolean;
  /** Seconds until the window resets. Only meaningful when refused. */
  retryAfter: number;
}

export class RateLimiter {
  private readonly windows = new Map<string, Window>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  take(key: string, now = Date.now()): Verdict {
    const window = this.windows.get(key);

    if (!window || window.resetAt <= now) {
      this.sweep(now);
      this.windows.set(key, { count: 1, resetAt: now + this.windowMs });
      return { allowed: true, retryAfter: 0 };
    }

    window.count += 1;
    if (window.count > this.limit) {
      return { allowed: false, retryAfter: Math.max(1, Math.ceil((window.resetAt - now) / 1000)) };
    }
    return { allowed: true, retryAfter: 0 };
  }

  /** Only for tests, which must not inherit counts from the case before. */
  reset(): void {
    this.windows.clear();
  }

  private sweep(now: number): void {
    if (this.windows.size < MAX_KEYS) return;
    for (const [key, window] of this.windows) {
      if (window.resetAt <= now) this.windows.delete(key);
    }
    // Still full: every window is live, which means this is an attack rather than
    // traffic. Dropping the table forgives some counts, which is better than growing
    // until the instance dies - the limit is a brake, not a ledger.
    if (this.windows.size >= MAX_KEYS) this.windows.clear();
  }
}

/**
 * A preHandler that refuses when the caller has spent its allowance.
 *
 * Keyed on the client address with any port removed. trustProxy means request.ip is
 * computed from X-Forwarded-For, and Azure writes "ip:port" there with a fresh port
 * per connection - so keying on request.ip directly makes every request a new caller
 * and the limit never fires. It did exactly that in the deployment before this.
 */
export function rateLimit(limiter: RateLimiter) {
  return async function enforce(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const verdict = limiter.take(stripPort(request.ip));
    if (verdict.allowed) return;
    reply.header('Retry-After', String(verdict.retryAfter));
    throw new HttpError(429, `Too many requests. Try again in ${verdict.retryAfter} seconds.`);
  };
}
