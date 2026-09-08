import { parseJobsWithSchools, type JobRowWithSchool, type JobWithSchool } from '@mwalimu/core';
import type { Tables } from '@mwalimu/types';
import { supabase } from './supabase';
import { JOB_SELECT } from './job-select';

/** RLS scopes these to the signed-in teacher; no user filter is needed here. */

export interface NotificationFeed {
  readonly items: readonly Tables<'notifications'>[];
  /**
   * Jobs referenced by `job_match` rows, keyed by id.
   *
   * The trigger deliberately does NOT store a match score: a score baked in at
   * insert time would need a second matcher in SQL, and it would go stale the
   * moment the teacher edits their profile. The job comes back with the feed so
   * the screen can score it live through the one matcher.
   */
  readonly jobs: ReadonlyMap<string, JobWithSchool>;
}


/**
 * The job a `job_match` notification points at. Null for every other kind, and
 * for a malformed payload — one source of truth for reading that key, so the
 * fetch and the screen can never disagree about which rows carry a job.
 */
export const jobIdOf = (n: Tables<'notifications'>): string | null => {
  if (n.kind !== 'job_match') return null;
  const id = (n.payload as { job_id?: unknown }).job_id;
  return typeof id === 'string' ? id : null;
};

export async function fetchNotifications(): Promise<NotificationFeed> {
  const { data, error } = await supabase
    .from('notifications').select('*').order('created_at', { ascending: false }).limit(50);

  if (error !== null) throw new Error(error.message);
  const items = data ?? [];

  const jobIds = [...new Set(
    items.map(jobIdOf).filter((id): id is string => id !== null),
  )];

  if (jobIds.length === 0) return { items, jobs: new Map() };

  const { data: jobRows } = await supabase.from('jobs').select(JOB_SELECT).in('id', jobIds);
  const { jobs } = parseJobsWithSchools((jobRows ?? []) as unknown as JobRowWithSchool[]);

  return { items, jobs: new Map(jobs.map((j) => [j.job.id, j])) };
}

export async function markAllRead(): Promise<void> {
  const { error } = await supabase
    .from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null);
  if (error !== null) throw new Error(error.message);
}
