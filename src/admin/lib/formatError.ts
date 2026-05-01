// Format any thrown value into a human-readable string. Catches
// Supabase PostgrestError / FunctionsHttpError objects (which are
// not Error instances and stringify to "[object Object]"), plain
// Error objects, and anything else.

interface MaybeSupabaseError {
  message?: unknown;
  details?: unknown;
  hint?: unknown;
  code?: unknown;
  context?: { body?: unknown };
}

export function formatError(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  if (e && typeof e === 'object') {
    const obj = e as MaybeSupabaseError;
    const msg = typeof obj.message === 'string' ? obj.message : null;
    const details = typeof obj.details === 'string' ? obj.details : null;
    const hint = typeof obj.hint === 'string' ? obj.hint : null;
    const code = typeof obj.code === 'string' || typeof obj.code === 'number' ? String(obj.code) : null;
    const parts = [msg, details, hint, code ? `(${code})` : null].filter(Boolean);
    if (parts.length > 0) return parts.join(' · ');
    try { return JSON.stringify(e); } catch { /* fallthrough */ }
  }
  return String(e);
}
