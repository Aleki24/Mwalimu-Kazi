import type { Tables } from '@mwalimu/types';
import { supabase } from './supabase';

/** News and the resource library — the two public reading surfaces. */

export async function fetchNews(topic?: Tables<'news_articles'>['topic']): Promise<readonly Tables<'news_articles'>[]> {
  let query = supabase.from('news_articles').select('*').order('published_at', { ascending: false }).limit(50);
  if (topic !== undefined) query = query.eq('topic', topic);

  const { data, error } = await query;
  if (error !== null) throw new Error(error.message);
  return data ?? [];
}

export async function fetchResources(kind?: Tables<'resources'>['kind']): Promise<readonly Tables<'resources'>[]> {
  let query = supabase.from('resources').select('*').order('download_count', { ascending: false }).limit(60);
  if (kind !== undefined) query = query.eq('kind', kind);

  const { data, error } = await query;
  if (error !== null) throw new Error(error.message);
  return data ?? [];
}

/** "2.5 MB" — resource sizes are stored in bytes. */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
