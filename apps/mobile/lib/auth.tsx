import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type ReactNode,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import { parseTeacherProfile } from '@mwalimu/core';
import type { TeacherProfile } from '@mwalimu/types';
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import { OPENED_FROM_RECOVERY_LINK, supabase } from './supabase';

/**
 * Auth state for the whole app.
 *
 * `status` is deliberately a single discriminated value rather than a handful of
 * booleans: "signed in but no profile row yet" is a real state the router has to
 * handle, and a `loading`/`session`/`profile` trio lets the caller forget it.
 */
/**
 * `recovering` is its own state, not a flag on top of the others.
 *
 * Opening a password-reset link signs you in — that is how Supabase delivers
 * the ability to change the password. Without a state for it, the router would
 * see a valid session and drop the teacher on Home, having never shown them
 * the screen the email promised.
 */
export type AuthStatus =
  | 'loading' | 'signed-out' | 'needs-onboarding' | 'ready' | 'recovering'
  /**
   * Signed in, with a profile row that will not parse.
   *
   * Its own state because the alternative was treating it as "no profile",
   * which sent the teacher to onboarding — where saving the same shape would
   * fail again, forever, with nothing on screen saying why. A row that exists
   * and disagrees with the schema is a fault to report, not a user to onboard.
   */
  | 'profile-unreadable';

export type AuthOutcome =
  | { readonly ok: true }
  | { readonly ok: true; readonly needsConfirmation: true }
  | { readonly ok: false; readonly reason: string };

/** Supabase's own floor. Checked here so the failure is legible, not a 422. */
const MIN_PASSWORD = 6;

/**
 * Where the emailed reset link should land.
 *
 * On web that is a real URL on this origin, so the same link works from the
 * deployed site and from a local dev server without being hardcoded. On a
 * device it is the app's own scheme, because there is no browser to return to.
 *
 * Either value must be listed under Authentication → URL Configuration →
 * Redirect URLs in Supabase, or the link silently sends people to the site
 * root with no token.
 */
function passwordResetRedirect(): string {
  return Platform.OS === 'web'
    ? `${globalThis.location.origin}/reset-password`
    : Linking.createURL('/reset-password');
}

export interface AuthValue {
  readonly status: AuthStatus;
  readonly session: Session | null;
  /** Non-null exactly when status is 'ready'. */
  readonly profile: TeacherProfile | null;
  /** Why the profile row would not parse, when status is 'profile-unreadable'. */
  readonly profileFault: string | null;
  readonly signIn: (email: string, password: string) => Promise<AuthOutcome>;
  /**
   * `needsConfirmation` is a real outcome, not an error. When the project has
   * "Confirm email" on, sign-up succeeds but returns no session until the link
   * is clicked — telling someone that failed would be a lie.
   */
  readonly signUp: (email: string, password: string) => Promise<AuthOutcome>;
  readonly requestPasswordReset: (email: string) => Promise<AuthOutcome>;
  readonly updatePassword: (password: string) => Promise<AuthOutcome>;
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
  const [profileFault, setProfileFault] = useState<string | null>(null);
  const [sessionResolved, setSessionResolved] = useState(false);
  const [profileResolved, setProfileResolved] = useState(false);
  // Seeded from the URL, not only from the event — see the note in
  // supabase.ts on why the event alone is missed on web.
  const [recovering, setRecovering] = useState(OPENED_FROM_RECOVERY_LINK);
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
      setProfileFault(null);
      setProfileResolved(true);
      return;
    }
    const parsed = parseTeacherProfile(data);
    setProfile(parsed.ok ? parsed.value : null);
    setProfileFault(parsed.ok ? null : parsed.reason);
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

    const { data: subscription } = supabase.auth.onAuthStateChange((event, next) => {
      // Supabase signs the user in to let them change the password. The event
      // is the only thing distinguishing that from an ordinary sign-in.
      if (event === 'PASSWORD_RECOVERY') setRecovering(true);
      setSession(next);
      setSessionResolved(true);
      setProfileResolved(false);
      void loadProfile(next?.user.id);
    });

    return () => { subscription.subscription.unsubscribe(); };
  }, [loadProfile]);

  const requestPasswordReset = useCallback<AuthValue['requestPasswordReset']>(async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      { redirectTo: passwordResetRedirect() },
    );
    if (error !== null) return { ok: false, reason: error.message };
    return { ok: true };
  }, []);

  const updatePassword = useCallback<AuthValue['updatePassword']>(async (password) => {
    if (password.length < MIN_PASSWORD) {
      return { ok: false, reason: `Use at least ${MIN_PASSWORD} characters.` };
    }
    const { error } = await supabase.auth.updateUser({ password });
    if (error !== null) return { ok: false, reason: error.message };
    setRecovering(false);
    return { ok: true };
  }, []);

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
    setRecovering(false);
  }, []);

  const status: AuthStatus = useMemo(() => {
    if (!sessionResolved) return 'loading';
    if (session === null) return 'signed-out';
    // Ahead of the profile checks: someone resetting a password must reach the
    // reset screen whether or not they have finished onboarding.
    if (recovering) return 'recovering';
    if (!profileResolved) return 'loading';
    if (profile !== null) return 'ready';
    return profileFault === null ? 'needs-onboarding' : 'profile-unreadable';
  }, [sessionResolved, session, profileResolved, profile, profileFault, recovering]);

  const value = useMemo<AuthValue>(
    () => ({
      status, session, profile, profileFault,
      signIn, signUp, requestPasswordReset, updatePassword, refreshProfile, signOut,
    }),
    [status, session, profile, signIn, signUp, requestPasswordReset, updatePassword, refreshProfile, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
