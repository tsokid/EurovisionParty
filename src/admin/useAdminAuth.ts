import { useEffect, useState, useCallback } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface State {
  status: 'loading' | 'anonymous' | 'pending_otp' | 'authenticated' | 'denied';
  email: string | null;
  /** The signed-in user's id (presence on CMS docs). */
  userId?: string | null;
  isAdmin: boolean;
  error: string | null;
}

export type AdminAuth = ReturnType<typeof useAdminAuth>;

export function useAdminAuth() {
  const [state, setState] = useState<State>({
    status: 'loading', email: null, isAdmin: false, error: null,
  });

  /** `known`: the session an auth event carried (null = signed out); omitted, it is read. */
  const refresh = useCallback(async (known?: Session | null) => {
    const session = known !== undefined ? known : (await supabase.auth.getSession()).data.session;
    if (!session) {
      setState({ status: 'anonymous', email: null, isAdmin: false, error: null });
      return;
    }
    const { data: row } = await supabase
      .from('super_admins')
      .select('user_id')
      .eq('user_id', session.user.id)
      .maybeSingle();
    if (row) {
      setState({ status: 'authenticated', email: session.user.email ?? null, userId: session.user.id, isAdmin: true, error: null });
    } else {
      await supabase.auth.signOut();
      setState({ status: 'denied', email: null, isAdmin: false, error: 'not_allowed' });
    }
  }, []);

  useEffect(() => {
    void refresh();
    // supabase-js awaits this callback while it holds its auth lock (token
    // refresh, tab focus). Calling supabase.auth here, or any query (it reads
    // the session for its token), waits for that same lock: a deadlock that
    // left every later request, and the CMS, on «Φόρτωση…» (23 Nov 2026).
    // So: use the session the event carries, and run the rest after the
    // callback has returned.
    let live = true;
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setTimeout(() => { if (live) void refresh(session); }, 0);
    });
    return () => {
      live = false;
      sub.subscription.unsubscribe();
    };
  }, [refresh]);

  const sendOtp = useCallback(async (email: string) => {
    setState((s) => ({ ...s, status: 'pending_otp', email, error: null }));
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-otp`;
    await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ email }),
    });
  }, []);

  const verifyOtp = useCallback(async (email: string, token: string) => {
    const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
    if (error) {
      setState((s) => ({ ...s, error: error.message }));
      return false;
    }
    // onAuthStateChange already calls refresh() when the session is established.
    // Don't await a second refresh here — it races with the listener and any
    // thrown error would leave the UI stuck on "Verifying…".
    return true;
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setState({ status: 'anonymous', email: null, isAdmin: false, error: null });
  }, []);

  return { ...state, sendOtp, verifyOtp, logout };
}
