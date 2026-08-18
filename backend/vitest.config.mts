import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        globals: true,
        include: ['tests/**/*.test.ts'],
        setupFiles: ['./tests/setup.ts'],
        // Socket handshakes and Mongo round trips are slower than unit tests.
        testTimeout: 30_000,
        hookTimeout: 60_000,
        // Every file drives a real server and database; running them in parallel
        // would have them fighting over the same port and collections.
        fileParallelism: false,
        pool: 'threads',
    },
});
