import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    // Azurite is still needed by the suites that exercise the Azure driver: the two
    // store conformance files, limits.test.ts, and bundle.test.ts. Everything else now
    // runs on the local backend with a store of its own per file.
    globalSetup: ['test/setup/azurite.ts'],
    // Back on. It was off because every app-level suite seeded the same
    // getting-started/dev scope into one shared Azurite account, so two files seeding at
    // once could let one read a half-written index - the workflow counts are a recount
    // over what is stored. Each file now has its own store (test/setup/store.ts) or its
    // own scope within Azurite, so there is nothing left to serialise.
    fileParallelism: true,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
