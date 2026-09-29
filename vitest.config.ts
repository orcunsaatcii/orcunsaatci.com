// vitest.config.ts
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  resolve: {
    alias: {
      // src/lib/seo/* ve get-dictionary.ts 'server-only' import eder (§11.8.1)
      'server-only': fileURLToPath(new URL('./tests/stubs/server-only.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts', 'tests/lint/**/*.test.ts'],
    exclude: ['tests/e2e/**', 'node_modules/**', '.next/**'],
    setupFiles: ['./tests/setup/vitest.setup.ts'],
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'lcov'],
      include: [
        'src/lib/**/*.ts',
        'src/i18n/**/*.ts',
        'src/stage/*.ts',
        'src/design/*.ts',
        'src/experience/*.ts',
      ],
      exclude: ['**/*.test.*', 'src/stage/gl/**'],
      thresholds: { lines: 85, functions: 85, branches: 75 },
    },
  },
});
