import type { Tables } from '@mwalimu/types';
import { supabase } from './supabase';

/** RLS scopes these to the signed-in teacher; no user filter is needed here. */

export async function fetchNotifications(): Promise<readonly Tables<'notifications'>[]> {
  const { data, error } = await supabase
    .from('notifications').select('*').order('created_at', { ascending: false }).limit(50);

  if (error !== null) throw new Error(error.message);
  return data ?? [];
}

export async function markAllRead(): Promise<void> {
  const { error } = await supabase
    .from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null);
  if (error !== null) throw new Error(error.message);
}
