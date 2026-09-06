import { parseJobsWithSchools, type JobRowWithSchool, type JobWithSchool } from '@mwalimu/core';
import { supabase } from './supabase';

/**
 * Saved jobs. RLS scopes every one of these to the signed-in teacher, so no
 * query here filters by user id — the database does it.
 */

const JOB_SELECT = `
  id, school_id, title, subjects, job_type, county,
  salary_min, salary_max, requirements, published,
  posted_at, closes_at, created_at,
  schools ( name, school_type, curricula )
` as const;

export async function fetchSavedJobIds(): Promise<ReadonlySet<string>> {
  const { data, error } = await supabase.from('saved_jobs').select('job_id');
  if (error !== null) throw new Error(error.message);
  return new Set((data ?? []).map((r) => r.job_id));
}

export async function fetchSavedJobs(): Promise<readonly JobWithSchool[]> {
  const { data, error } = await supabase
    .from('saved_jobs')
    .select(`created_at, jobs ( ${JOB_SELECT} )`)
    .order('created_at', { ascending: false });

  if (error !== null) throw new Error(error.message);

  const rows = (data ?? [])
    .map((r) => (r as unknown as { jobs: JobRowWithSchool | null }).jobs)
    .filter((j): j is JobRowWithSchool => j !== null);

  return parseJobsWithSchools(rows).jobs;
}

export async function saveJob(teacherId: string, jobId: string): Promise<void> {
  const { error } = await supabase.from('saved_jobs').insert({ teacher_id: teacherId, job_id: jobId });
  // A second save is the same outcome as the first, not a failure to report.
  if (error !== null && error.code !== '23505') throw new Error(error.message);
}

export async function unsaveJob(teacherId: string, jobId: string): Promise<void> {
  const { error } = await supabase
    .from('saved_jobs').delete().eq('teacher_id', teacherId).eq('job_id', jobId);
  if (error !== null) throw new Error(error.message);
}
