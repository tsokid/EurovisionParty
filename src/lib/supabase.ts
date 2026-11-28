import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. ' +
    'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.'
  )
}

// Disable the navigator Web Locks-based mutex. We don't need cross-tab session
// coordination, and StrictMode double-mounts (plus multiple concurrent
// `getSession()` calls from sibling hooks) cause the lock to be repeatedly
// stolen — which leaves `getSession()` permanently unresolved and the admin
// route stuck on a loading screen. See:
// https://github.com/supabase/auth-js/issues/762
const noopLock = async <R>(_name: string, _acquireTimeout: number, fn: () => Promise<R>): Promise<R> => fn()

/**
 * After a Realtime drop every phone reconnects. Without jitter they all
 * retry on the same beat (1 s, 2 s, 5 s, 10 s) and hit the server together;
 * each wait is spread over half to one and a half times its length (F10).
 */
export function reconnectAfterMs(tries: number): number {
  const base = [1_000, 2_000, 5_000, 10_000][tries - 1] ?? 10_000
  return Math.round(base * (0.5 + Math.random()))
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: { reconnectAfterMs },
  auth: {
    lock: noopLock,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
