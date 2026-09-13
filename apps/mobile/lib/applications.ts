import { parseJobsWithSchools, type JobRowWithSchool, type JobWithSchool } from '@mwalimu/core';
import type { Tables } from '@mwalimu/types';
import { supabase } from './supabase';
import { JOB_SELECT } from './job-select';

/**
 * Applications. RLS scopes reads to the signed-in teacher (and, separately, to
 * the receiving school), so nothing here filters by user id — the database
 * does it.
 */


/** Postgres unique_violation. A second apply is the same outcome as the first. */
const UNIQUE_VIOLATION = '23505';

export interface AppliedJob {
  readonly application: Tables<'applications'>;
  readonly entry: JobWithSchool;
}

/** The job ids this teacher has already applied to, for marking up a list. */
export async function fetchAppliedJobIds(): Promise<ReadonlySet<string>> {
  const { data, error } = await supabase.from('applications').select('job_id');
  if (error !== null) throw new Error(error.message);
  return new Set((data ?? []).map((r) => r.job_id));
}

export async function fetchApplications(): Promise<readonly AppliedJob[]> {
  const { data, error } = await supabase
    .from('applications')
    .select(`*, jobs ( ${JOB_SELECT} )`)
    .order('created_at', { ascending: false });

  if (error !== null) throw new Error(error.message);

  const rows = data ?? [];
  const jobRows = rows
    .map((r) => (r as unknown as { jobs: JobRowWithSchool | null }).jobs)
    .filter((j): j is JobRowWithSchool => j !== null);

  const byId = new Map(parseJobsWithSchools(jobRows).jobs.map((j) => [j.job.id, j]));

  return rows.flatMap((application) => {
    const entry = byId.get(application.job_id);
    // A row whose job would not parse is dropped rather than rendered half
    // empty; parseJobsWithSchools has already reported it.
    return entry === undefined ? [] : [{ application, entry }];
  });
}

/**
 * Submit an application.
 *
 * `matchScore` is frozen into the row on purpose — the opposite of the job
 * match notification, which scores live. A notification is a prompt and should
 * track the teacher's profile as it changes; an application is a record of what
 * the school actually received, and must not move under them afterwards.
 *
 * Returns false if an application already existed, so the caller can say
 * "already applied" rather than reporting a failure.
 */
export async function applyToJob(
  teacherId: string,
  jobId: string,
  matchScore: number,
): Promise<boolean> {
  const { error } = await supabase.from('applications').insert({
    teacher_id: teacherId,
    job_id: jobId,
    match_score: matchScore,
    source: 'manual',
  });

  if (error === null) return true;
  if (error.code === UNIQUE_VIOLATION) return false;
  throw new Error(error.message);
}

/**
 * Take an application back.
 *
 * `withdrawn` has been in the stage enum since the first migration and was
 * unreachable: every UPDATE policy on applications belonged to the school or
 * the poster, so the one person who cannot change their mind was the applicant.
 * 0035 gives them an UPDATE narrowed by a guard to this single word — they
 * still cannot shortlist themselves, rewrite the school's note, or touch the
 * score the school received.
 */
export async function withdrawApplication(applicationId: string): Promise<void> {
  const { error } = await supabase
    .from('applications').update({ stage: 'withdrawn' }).eq('id', applicationId);
  if (error !== null) throw new Error(error.message);
}
