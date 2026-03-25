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
      // Check for an existing session first
      const { data: { session: existing } } = await supabase.auth.getSession();

      if (existing) {
        setSession(existing);
        return;
      }

      // No session - sign in anonymously
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error) throw error;
      setSession(data.session);
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
