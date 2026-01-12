import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/tests/setup.ts'],
    env: {
      NODE_ENV: 'test',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/**',
        'dist/**',
        'src/tests/**',
        '**/*.spec.ts',
        '**/*.test.ts',
        'vitest.config.ts',
        'prisma/**',
        'src/types/**',
        'src/server.ts',
        '**/*.config.ts',
      ],
    },
    testTimeout: 30000,
    singleThread: true,
    fileParallelism: false,
  },
});
