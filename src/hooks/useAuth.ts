import { useState, useEffect, useCallback } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { cleanupStaleSessions } from './useRoom';

interface UseAuthReturn {
  session: Session | null;
  userId: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

export function useAuth(): UseAuthReturn {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const ensureSession = useCallback(async () => {
    try {
      // Only reads the session: a visit creates no account. The anonymous
      // user is made on create/join (ensureUser), 23 Nov 2026.
      const { data: { session: existing } } = await supabase.auth.getSession();
      setSession(existing);
    } catch (err) {
      console.error('[useAuth] Failed to initialise auth:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    cleanupStaleSessions();
    ensureSession();

    // Listen to future auth state changes (token refresh, sign-out, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [ensureSession]);

  return {
    session,
    userId: session?.user?.id ?? null,
    isLoading,
    isAuthenticated: !!session,
  };
}
