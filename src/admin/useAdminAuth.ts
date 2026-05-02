import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

interface State {
  status: 'loading' | 'anonymous' | 'pending_otp' | 'authenticated' | 'denied';
  email: string | null;
  isAdmin: boolean;
  error: string | null;
}

export type AdminAuth = ReturnType<typeof useAdminAuth>;

export function useAdminAuth() {
  const [state, setState] = useState<State>({
    status: 'loading', email: null, isAdmin: false, error: null,
  });

  const refresh = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
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
      setState({ status: 'authenticated', email: session.user.email ?? null, isAdmin: true, error: null });
    } else {
      await supabase.auth.signOut();
      setState({ status: 'denied', email: null, isAdmin: false, error: 'not_allowed' });
    }
  }, []);

  useEffect(() => {
    refresh();
    const { data: sub } = supabase.auth.onAuthStateChange(() => refresh());
    return () => sub.subscription.unsubscribe();
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
