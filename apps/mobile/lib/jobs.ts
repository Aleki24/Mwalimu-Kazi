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

/** How many rows one scroll-page pulls. */
export const JOBS_PAGE_SIZE = 20;

/** Opaque position in the recency ordering. */
export interface JobsCursor {
  readonly postedAt: string;
  readonly id: string;
}

export interface JobsPage {
  readonly jobs: readonly JobWithSchool[];
  readonly skipped: readonly string[];
  /** Null once the end is reached. */
  readonly next: JobsCursor | null;
}

/**
 * One page of open vacancies, newest first.
 *
 * Ordered by recency, not by match, and that is a deliberate limit rather than
 * an oversight. Match ranking lives in `@mwalimu/core` so one matcher serves
 * every view — but a client-side ranking can only order what it has loaded, so
 * a match-ordered infinite list would silently reshuffle as you scrolled and
 * "best match" would mean "best of the first forty". Recency is stable under
 * paging; the per-card score still tells a teacher what each row is worth, and
 * Home's "Top matches" does the real ranking over a bounded recent window.
 *
 * Keyset, not OFFSET: a job published while someone is scrolling shifts every
 * offset by one and makes a row appear twice. (posted_at, id) is unique and
 * ordered, so a cursor stays correct however much the table changes underneath.
 */
export async function fetchJobsPage(cursor: JobsCursor | null): Promise<JobsPage> {
  let query = supabase
    .from('jobs')
    .select(JOB_SELECT)
    .eq('published', true)
    .order('posted_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(JOBS_PAGE_SIZE);

  if (cursor !== null) {
    // Strictly after the cursor in (posted_at desc, id desc) order.
    query = query.or(
      `posted_at.lt.${cursor.postedAt},and(posted_at.eq.${cursor.postedAt},id.lt.${cursor.id})`,
    );
  }

  const { data, error } = await query;
  if (error !== null) throw new Error(error.message);

  const rows = (data ?? []) as unknown as JobRowWithSchool[];
  const { jobs, skipped } = parseJobsWithSchools(rows);

  // The cursor comes from the last ROW, not the last parsed job: a row that
  // failed to parse still occupies a position, and skipping it would re-fetch
  // everything after it forever.
  const lastRow = rows[rows.length - 1];
  const next = rows.length < JOBS_PAGE_SIZE || lastRow === undefined
    ? null
    : { postedAt: lastRow.posted_at, id: lastRow.id };

  return { jobs, skipped, next };
}
