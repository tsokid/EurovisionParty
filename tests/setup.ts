import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// src/lib/supabase.ts throws at import if these are missing; SSR tests import
// the full route tree, which pulls in the Supabase client.
vi.stubEnv('VITE_SUPABASE_URL', import.meta.env.VITE_SUPABASE_URL || 'http://localhost:54321');
vi.stubEnv('VITE_SUPABASE_ANON_KEY', import.meta.env.VITE_SUPABASE_ANON_KEY || 'test-anon-key');
