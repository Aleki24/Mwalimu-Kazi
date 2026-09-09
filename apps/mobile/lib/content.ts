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

/**
 * A URL the teacher can actually open, and the count that follows from it.
 *
 * The bucket is private, so this is a signed URL with a short life rather than
 * a permanent link: the library is a reason to have an account, and a public
 * object URL outlives any decision to change that.
 *
 * The count goes through an RPC because `resources` has no update policy and
 * should not get one — a counter the client can write is a counter anyone can
 * inflate, and this one orders the list.
 *
 * It is awaited, and it took a browser to show why: fire-and-forget looked
 * right ("counting must not delay the download") but the very next thing the
 * caller does is hand the URL to the browser, which navigates and cancels the
 * in-flight request. The count never moved. Awaited and swallowed is the
 * version that both counts and cannot fail the download.
 */
export async function resourceDownloadUrl(
  resource: Pick<Tables<'resources'>, 'id' | 'storage_path'>,
): Promise<string> {
  const { data, error } = await supabase.storage
    .from('resources')
    .createSignedUrl(resource.storage_path, 60 * 5, { download: true });

  if (error !== null || data === null) {
    throw new Error(error?.message ?? 'That file could not be prepared for download');
  }

  try {
    await supabase.rpc('record_resource_download', { target_resource: resource.id });
  } catch {
    // A download that happened is worth more than a tally that is exact.
  }
  return data.signedUrl;
}

/** "2.5 MB" — resource sizes are stored in bytes. */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
