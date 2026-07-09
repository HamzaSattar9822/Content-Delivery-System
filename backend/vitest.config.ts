import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Provide deterministic secrets so token signing utilities work in tests.
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
      JWT_ACCESS_SECRET: 'test_access_secret_value',
      JWT_REFRESH_SECRET: 'test_refresh_secret_value',
      LINK_SIGNING_SECRET: 'test_link_signing_secret_value',
    },
  },
});
