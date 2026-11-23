import type { User } from '@supabase/supabase-js';
import { supabase } from './supabase';

/**
 * The signed-in (anonymous) user, created on first need: creating or joining
 * a room. Visiting the site makes no account (23 Nov 2026: every home visit,
 * crawlers included, used to create one: 2,102 users for 7 players).
 */
export async function ensureUser(): Promise<User> {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) return session.user;
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  const user = data.user ?? data.session?.user;
  if (!user) throw new Error('Not authenticated');
  return user;
}
