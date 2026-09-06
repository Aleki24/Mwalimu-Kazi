import {
  parseJobsWithSchools, rankJobs, filterJobs,
  type JobFilters, type JobRowWithSchool, type JobWithSchool, type RankedJob,
} from '@mwalimu/core';
import type { TeacherProfile } from '@mwalimu/types';
import { supabase } from './supabase';

/**
 * Job reads.
 *
 * Filtering and ranking run in `@mwalimu/core` rather than in SQL: the same
 * functions are unit-tested, and the recruiter dashboard will reuse them. The
 * query fetches the open set; core decides what the teacher sees and in what
 * order.
 */

const JOB_SELECT = `
  id, school_id, title, subjects, job_type, county,
  salary_min, salary_max, requirements, published,
  posted_at, closes_at, created_at,
  schools ( name, school_type, curricula )
` as const;

export interface JobsResult {
  readonly jobs: readonly RankedJob[];
  /** Rows we could not parse. Surfaced so bad data is visible, not silent. */
  readonly skipped: readonly string[];
}

/** Open, published vacancies, newest first. RLS keeps unpublished rows out. */
export async function fetchOpenJobs(): Promise<{
  readonly jobs: readonly JobWithSchool[];
  readonly skipped: readonly string[];
}> {
  const { data, error } = await supabase
    .from('jobs')
    .select(JOB_SELECT)
    .eq('published', true)
    .order('posted_at', { ascending: false })
    .limit(100);

  if (error !== null) throw new Error(error.message);
  return parseJobsWithSchools((data ?? []) as unknown as JobRowWithSchool[]);
}

/** Fetch, filter and rank in one call — what the Jobs screen renders. */
export async function fetchRankedJobs(
  teacher: TeacherProfile,
  filters: JobFilters,
  now: Date = new Date(),
): Promise<JobsResult> {
  const { jobs, skipped } = await fetchOpenJobs();
  return { jobs: rankJobs(filterJobs(jobs, filters), teacher, now), skipped };
}

export async function fetchJobById(id: string): Promise<JobWithSchool | null> {
  const { data, error } = await supabase
    .from('jobs')
    .select(JOB_SELECT)
    .eq('id', id)
    .maybeSingle();

  if (error !== null) throw new Error(error.message);
  if (data === null) return null;

  const { jobs } = parseJobsWithSchools([data as unknown as JobRowWithSchool]);
  return jobs[0] ?? null;
}
