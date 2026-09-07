import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type ReactNode,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import { parseTeacherProfile } from '@mwalimu/core';
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

export type AuthOutcome =
  | { readonly ok: true }
  | { readonly ok: true; readonly needsConfirmation: true }
  | { readonly ok: false; readonly reason: string };

/** Supabase's own floor. Checked here so the failure is legible, not a 422. */
const MIN_PASSWORD = 6;

export interface AuthValue {
  readonly status: AuthStatus;
  readonly session: Session | null;
  /** Non-null exactly when status is 'ready'. */
  readonly profile: TeacherProfile | null;
  readonly signIn: (email: string, password: string) => Promise<AuthOutcome>;
  /**
   * `needsConfirmation` is a real outcome, not an error. When the project has
   * "Confirm email" on, sign-up succeeds but returns no session until the link
   * is clicked — telling someone that failed would be a lie.
   */
  readonly signUp: (email: string, password: string) => Promise<AuthOutcome>;
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

  const signIn = useCallback<AuthValue['signIn']>(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({
      // Supabase lowercases the stored address, but the keyboard on a phone
      // capitalises the first letter. Without this a teacher can be told their
      // own password is wrong.
      email: email.trim().toLowerCase(),
      password,
    });
    if (error !== null) return { ok: false, reason: error.message };
    return { ok: true };
  }, []);

  const signUp = useCallback<AuthValue['signUp']>(async (email, password) => {
    if (password.length < MIN_PASSWORD) {
      return { ok: false, reason: `Use at least ${MIN_PASSWORD} characters.` };
    }

    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error !== null) return { ok: false, reason: error.message };

    // No session means the project requires email confirmation. The account
    // exists; it just cannot be used until the link is clicked.
    return data.session === null ? { ok: true, needsConfirmation: true } : { ok: true };
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
    () => ({ status, session, profile, signIn, signUp, refreshProfile, signOut }),
    [status, session, profile, signIn, signUp, refreshProfile, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
