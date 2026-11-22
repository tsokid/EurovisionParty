import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// src/lib/supabase.ts throws at import if these are missing; SSR tests import
// the full route tree, which pulls in the Supabase client.
vi.stubEnv('VITE_SUPABASE_URL', import.meta.env.VITE_SUPABASE_URL || 'http://localhost:54321');
vi.stubEnv('VITE_SUPABASE_ANON_KEY', import.meta.env.VITE_SUPABASE_ANON_KEY || 'test-anon-key');

// The live avatars library (src/components/stage/avatars/library.ts) asks
// Supabase for the published avatars when an avatar renders. Tests answer
// "unreachable" by default, so every avatar comes from the static registry as
// before; tests of the library install their own client.
import { __setAvatarClientForTests } from '../src/components/stage/avatars/library';
const offline = { error: { message: 'offline (tests)' }, data: null };
const offlineQuery: Record<string, unknown> = new Proxy({}, {
  get: (_t, prop) => (prop === 'then' ? (resolve: (v: unknown) => void) => resolve(offline) : () => offlineQuery),
});
__setAvatarClientForTests({
  from: () => offlineQuery,
  rpc: () => Promise.resolve(offline),
  storage: { from: () => ({ getPublicUrl: (p: string) => ({ data: { publicUrl: `/storage/${p}` } }) }) },
});

// The editor's preview is an iframe of the app (src/admin/preview). jsdom
// cannot load the app into an iframe, so the suites drive the same bridge
// inline (in-memory port); tests of the iframe host set it explicitly.
import { __setPreviewTransportForTests } from '../src/admin/preview/transportDefault';
__setPreviewTransportForTests({ kind: 'inline' });
