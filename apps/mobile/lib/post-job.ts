import type { County, JobType } from '@mwalimu/types';
import { supabase } from './supabase';

export interface JobDraft {
  /**
   * The school this role belongs to, or null for an independent listing.
   *
   * This is the single most consequential field on the form: with it the
   * listing carries a school's name and verification status, without it the
   * app labels it as posted by an individual. RLS checks membership, so a
   * school id you do not belong to is rejected rather than trusted.
   */
  readonly schoolId: string | null;
  readonly title: string;
  readonly county: string;
  readonly subjects: readonly string[];
  readonly jobType: JobType;
  readonly salaryMin: number | null;
  readonly salaryMax: number | null;
}

/** @deprecated Kept so the older call shape still type-checks. */
export type IndependentJobDraft = Omit<JobDraft, 'schoolId'>;

/**
 * Post a job, for a school or as an individual.
 *
 * `posted_by` and `poster_kind` are never sent: a BEFORE trigger sets both
 * from auth.uid() and from whether a school is attached, so a client cannot
 * claim to be a school or attribute the listing to someone else.
 */
export async function postJob(draft: JobDraft): Promise<void> {
  const { error } = await supabase.from('jobs').insert({
    school_id: draft.schoolId,
    title: draft.title,
    county: draft.county as County,
    subjects: [...draft.subjects],
    job_type: draft.jobType,
    salary_min: draft.salaryMin,
    salary_max: draft.salaryMax,
    published: true,
  });
  if (error !== null) throw new Error(error.message);
}

/** Schools this person may post for. Empty for most teachers. */
export async function fetchPostableSchools(): Promise<
  ReadonlyArray<{ readonly id: string; readonly name: string }>
> {
  const { data, error } = await supabase.from('school_members').select('schools ( id, name )');
  if (error !== null) throw new Error(error.message);
  return (data ?? [])
    .map((r) => (r as unknown as { schools: { id: string; name: string } | null }).schools)
    .filter((s): s is { id: string; name: string } => s !== null);
}
