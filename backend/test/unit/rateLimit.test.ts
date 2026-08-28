import { describe, expect, test } from 'vitest';
import { RateLimiter } from '../../src/routes/rateLimit.js';

/**
 * The brake on the routes that cannot be authenticated.
 *
 * Time is passed in rather than mocked, because the window is the whole behaviour
 * and a test that cannot move the clock can only assert the easy half of it.
 */
describe('the fixed-window rate limiter', () => {
  test('allows exactly the limit, then refuses', () => {
    const limiter = new RateLimiter(3, 60_000);
    const now = 1_000_000;
    expect([1, 2, 3].map(() => limiter.take('a', now).allowed)).toEqual([true, true, true]);
    expect(limiter.take('a', now).allowed).toBe(false);
  });

  test('says how long to wait, and never says zero', () => {
    const limiter = new RateLimiter(1, 60_000);
    const now = 1_000_000;
    limiter.take('a', now);
    expect(limiter.take('a', now).retryAfter).toBe(60);
    // 100 ms left rounds up to 1, not down to 0 - a Retry-After of 0 invites an
    // immediate retry, which is the thing being prevented.
    expect(limiter.take('a', now + 59_900).retryAfter).toBe(1);
  });

  test('forgets the count once the window has passed', () => {
    const limiter = new RateLimiter(1, 60_000);
    const now = 1_000_000;
    expect(limiter.take('a', now).allowed).toBe(true);
    expect(limiter.take('a', now + 59_999).allowed).toBe(false);
    expect(limiter.take('a', now + 60_000).allowed).toBe(true);
  });

  test('counts each key separately, so one address cannot lock out another', () => {
    const limiter = new RateLimiter(1, 60_000);
    const now = 1_000_000;
    expect(limiter.take('a', now).allowed).toBe(true);
    expect(limiter.take('a', now).allowed).toBe(false);
    expect(limiter.take('b', now).allowed).toBe(true);
  });

  test('does not grow without bound when every caller is new', () => {
    const limiter = new RateLimiter(5, 1_000);
    const start = 1_000_000;
    // 12_000 distinct addresses, all expired by the time the sweep runs.
    for (let i = 0; i < 12_000; i++) limiter.take(`addr-${i}`, start + i);
    // Still counting correctly afterwards, which is what the sweep must not break.
    const now = start + 100_000;
    expect(limiter.take('someone', now).allowed).toBe(true);
    expect(limiter.take('someone', now).allowed).toBe(true);
  });
});
