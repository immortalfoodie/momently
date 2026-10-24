import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [fileURLToPath(new URL('./vitest.setup.ts', import.meta.url))],
    testTimeout: 15000,
    pool: 'threads',
    maxWorkers: 2,
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage',
      reporter: ['text-summary', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        '**/*.d.ts',
        'tests/**',
        'src/domain/types.ts',
        'src/engine/context.ts',
        'src/engine/chaos/types.ts',
        'src/engine/scheduleDelayTypes.ts',
        'src/engine/assistant/types.ts',
        'src/llm/types.ts',
        'src/data/templates/types.ts',
      ],
      thresholds: {
        statements: 87,
        branches: 75,
        functions: 86,
        lines: 89,
        'src/engine/**': {
          statements: 85,
        },
        'src/lib/**': {
          statements: 85,
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
