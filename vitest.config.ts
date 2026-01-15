import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/tests/setup.ts'],
    // Evita executar arquivos gerados pelo build (ex: dist/tests/*.test.js)
    include: ['src/tests/**/*.test.ts', 'src/tests/**/*.spec.ts'],
    exclude: ['node_modules/**', 'dist/**'],
    env: {
      NODE_ENV: 'test',
      ...(process.env.DATABASE_URL && { DATABASE_URL: process.env.DATABASE_URL }),
      ...(process.env.JWT_SECRET && { JWT_SECRET: process.env.JWT_SECRET }),
      ...(process.env.JWT_REFRESH_SECRET && { JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET }),
      ...(process.env.JWT_EXPIRES_IN && { JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN }),
      ...(process.env.JWT_REFRESH_EXPIRES_IN && {
        JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN,
      }),
      ...(process.env.REDIS_URL && { REDIS_URL: process.env.REDIS_URL }),
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
