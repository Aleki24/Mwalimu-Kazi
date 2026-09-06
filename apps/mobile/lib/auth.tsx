import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type ReactNode,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import { parseTeacherProfile, toE164Kenya } from '@mwalimu/core';
import type { TeacherProfile } from '@mwalimu/types';
import { supabase } from './supabase';

/**
 * Auth state for the whole app.
 *
 * `status` is deliberately a single discriminated value rather than a handful of
 * booleans: "signed in but no profile row yet" is a real state the router has to
 * handle, and a `loading`/`session`/`profile` trio lets the caller forget it.
 */
export type AuthStatus = 'loading' | 'signed-out' | 'needs-onboarding' | 'ready';

export interface AuthValue {
  readonly status: AuthStatus;
  readonly session: Session | null;
  /** Non-null exactly when status is 'ready'. */
  readonly profile: TeacherProfile | null;
  readonly sendOtp: (phone: string) => Promise<{ ok: true; e164: string } | { ok: false; reason: string }>;
  readonly verifyOtp: (e164: string, token: string) => Promise<{ ok: true } | { ok: false; reason: string }>;
  readonly refreshProfile: () => Promise<void>;
  readonly signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (value === null) throw new Error('useAuth must be used inside <AuthProvider>');
  return value;
}

/** The signed-in teacher, for screens that only render when status is 'ready'. */
export function useTeacher(): TeacherProfile {
  const { profile } = useAuth();
  if (profile === null) throw new Error('useTeacher used outside a signed-in screen');
  return profile;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<TeacherProfile | null>(null);
  const [sessionResolved, setSessionResolved] = useState(false);
  const [profileResolved, setProfileResolved] = useState(false);
  const mounted = useRef(true);

  useEffect(() => () => { mounted.current = false; }, []);

  const loadProfile = useCallback(async (userId: string | undefined) => {
    if (userId === undefined) {
      setProfile(null);
      setProfileResolved(true);
      return;
    }
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (!mounted.current) return;

    if (error !== null || data === null) {
      // No row yet is the normal first-sign-in case, not a failure.
      setProfile(null);
      setProfileResolved(true);
      return;
    }
    const parsed = parseTeacherProfile(data);
    setProfile(parsed.ok ? parsed.value : null);
    setProfileResolved(true);
  }, []);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted.current) return;
      setSession(data.session);
      setSessionResolved(true);
      await loadProfile(data.session?.user.id);
    })();

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setSessionResolved(true);
      setProfileResolved(false);
      void loadProfile(next?.user.id);
    });

    return () => { subscription.subscription.unsubscribe(); };
  }, [loadProfile]);

  const sendOtp = useCallback<AuthValue['sendOtp']>(async (phone) => {
    // Normalise before anything touches the API: Supabase keys the user on this
    // string, so two formats of one number would become two accounts.
    const parsed = toE164Kenya(phone);
    if (!parsed.ok) return parsed;

    const { error } = await supabase.auth.signInWithOtp({ phone: parsed.e164 });
    if (error !== null) return { ok: false, reason: error.message };
    return { ok: true, e164: parsed.e164 };
  }, []);

  const verifyOtp = useCallback<AuthValue['verifyOtp']>(async (e164, token) => {
    const code = token.trim();
    if (!/^\d{6}$/.test(code)) return { ok: false, reason: 'Enter the 6-digit code' };

    const { error } = await supabase.auth.verifyOtp({ phone: e164, token: code, type: 'sms' });
    if (error !== null) return { ok: false, reason: error.message };
    return { ok: true };
  }, []);

  const refreshProfile = useCallback(async () => {
    setProfileResolved(false);
    await loadProfile(session?.user.id);
  }, [loadProfile, session]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
  }, []);

  const status: AuthStatus = useMemo(() => {
    if (!sessionResolved) return 'loading';
    if (session === null) return 'signed-out';
    if (!profileResolved) return 'loading';
    return profile === null ? 'needs-onboarding' : 'ready';
  }, [sessionResolved, session, profileResolved, profile]);

  const value = useMemo<AuthValue>(
    () => ({ status, session, profile, sendOtp, verifyOtp, refreshProfile, signOut }),
    [status, session, profile, sendOtp, verifyOtp, refreshProfile, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
