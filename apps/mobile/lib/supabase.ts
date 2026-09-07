import 'react-native-url-polyfill/auto';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@mwalimu/types';

/**
 * The publishable key identifies the project; it does not grant access. Row
 * Level Security is what protects data, so this shipping in the app bundle is
 * expected rather than a leak.
 */
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (url === undefined || anonKey === undefined) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. Copy .env.example to .env at the repo root.',
  );
}

/**
 * Whether this page was opened from a password-reset link.
 *
 * Captured at module load, BEFORE createClient runs. `detectSessionInUrl`
 * consumes the fragment and clears it during construction, and it does that
 * before any React component can subscribe to auth events — so a provider that
 * waits for the PASSWORD_RECOVERY event misses it entirely and the teacher
 * lands in the app instead of on the reset screen. Reading the URL first is
 * the only reliable signal on web.
 */
export const OPENED_FROM_RECOVERY_LINK: boolean =
  Platform.OS === 'web' && /(^|[#&])type=recovery(&|$)/.test(globalThis.location?.hash ?? '');

/**
 * The message from a reset link that did not work, if this page was opened
 * from one. Captured with the flag above and for the same reason.
 *
 * Reset links are one-time and expire after an hour, so clicking yesterday's
 * email is a normal thing to do. Without this the app just shows the sign-in
 * screen, and the teacher has no idea their link was the problem.
 */
export const RECOVERY_LINK_ERROR: string | null = (() => {
  if (Platform.OS !== 'web') return null;
  const hash = globalThis.location?.hash ?? '';
  if (!hash.includes('error')) return null;
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const description = params.get('error_description');
  if (description === null) return null;
  return params.get('error_code') === 'otp_expired'
    ? 'That reset link has expired or was already used. Request a new one.'
    : description;
})();

export const supabase = createClient<Database>(url, anonKey, {
  auth: {
    storage: AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
    // A password-reset link arrives as a token in the URL fragment, so on web
    // this must be on or the link does nothing. React Native has no URL bar
    // for one to land in, so it stays off there.
    detectSessionInUrl: Platform.OS === 'web',
  },
});
