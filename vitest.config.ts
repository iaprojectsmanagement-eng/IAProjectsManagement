import { defineConfig } from 'vitest/config';

process.env.VITE_DATA_MODE = 'local';
process.env.VITE_SUPABASE_URL = '';
process.env.VITE_SUPABASE_PUBLISHABLE_KEY = '';
process.env.VITE_SUPABASE_ANON_KEY = '';

export default defineConfig({
  test: {
    exclude: ['e2e/**', '.release-repo/**', 'node_modules/**', 'dist/**'],
  },
});
