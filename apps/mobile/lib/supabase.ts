import 'react-native-url-polyfill/auto';
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

export const supabase = createClient<Database>(url, anonKey, {
  auth: {
    storage: AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
    // React Native has no URL bar for OAuth redirects to land in.
    detectSessionInUrl: false,
  },
});
