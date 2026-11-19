import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

const CONTENT_FIXTURE = path.resolve(__dirname, './tests/fixtures/content-live-hub');

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    // Node loaders (scripts/seo/loadContent.ts) read the same frozen copy.
    env: { EUROPARTY_CONTENT_DIR: CONTENT_FIXTURE },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // A frozen content snapshot (2026 finalized, its hub live), so tests do
      // not change with every Publish. Tests of the committed content/ and
      // vercel.json read those files directly.
      '@content': CONTENT_FIXTURE,
    },
  },
});
