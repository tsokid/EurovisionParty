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

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    lock: noopLock,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
