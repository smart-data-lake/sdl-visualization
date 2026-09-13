/**
 * What the switcher does when the URL's repository is not one the backend has.
 *
 * At a bare tenant this is the *only* way anyone reaches their data; under /content it
 * self-corrects. On /settings it must do neither, and used to do both - which bounced
 * the access token page off the screen and left a fresh installation unbootstrappable.
 */
import { describe, expect, test } from 'vitest';
import { nextRepo } from '../src/layouts/Authentication';

const REPOS = ['getting-started', 'other'];

describe('the settings pages are left alone', () => {
  test('with repositories to offer, it does not drag settings into one', () => {
    expect(nextRepo('settings', REPOS, undefined)).toBeUndefined();
  });

  test('nor with none', () => {
    expect(nextRepo('settings', [], undefined)).toBeUndefined();
  });
});

describe('a bare tenant still enters the workspace', () => {
  test('the first repository, which is how anyone reaches their data at all', () => {
    expect(nextRepo('root', REPOS, undefined)).toEqual({ repo: 'getting-started' });
  });

  test('a fresh installation has nothing to enter, and stays put', () => {
    // undefined repo, not "no navigation": setRepo(undefined) returns to the tenant,
    // which is where WorkspaceEmpty and its upload guide live.
    expect(nextRepo('root', [], undefined)).toEqual({ repo: undefined });
  });
});

describe('a content URL still self-corrects', () => {
  test('a repository that has gone away is replaced', () => {
    expect(nextRepo('content', REPOS, 'gone')).toEqual({ repo: 'getting-started' });
  });

  test('one that is still there is left alone, so this cannot loop', () => {
    expect(nextRepo('content', REPOS, 'other')).toBeUndefined();
  });
});
