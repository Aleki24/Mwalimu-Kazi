import type { County, JobType } from '@mwalimu/types';
import { supabase } from './supabase';

export interface IndependentJobDraft {
  readonly title: string;
  readonly county: string;
  readonly subjects: readonly string[];
  readonly jobType: JobType;
  readonly salaryMin: number | null;
  readonly salaryMax: number | null;
}

/**
 * Post a job that belongs to no school.
 *
 * `school_id` is left null on purpose — that is what makes the row an
 * independent listing. `posted_by` and `poster_kind` are NOT sent: a BEFORE
 * trigger sets both from auth.uid(), so a client cannot claim to be a school
 * or attribute the listing to someone else.
 */
export async function postIndependentJob(draft: IndependentJobDraft): Promise<void> {
  const { error } = await supabase.from('jobs').insert({
    school_id: null,
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
