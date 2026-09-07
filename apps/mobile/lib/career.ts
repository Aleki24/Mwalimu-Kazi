import { profileStrength, type ProfileStrength } from '@mwalimu/core';
import type { TeacherProfile } from '@mwalimu/types';
import { supabase } from './supabase';

/**
 * The numbers on the Home dashboard.
 *
 * Counts come from the `stage` a school actually set on the application, so
 * they cannot flatter anyone: "2 interviews" means two schools moved you to
 * that stage, not that two looked promising.
 */
export interface CareerSnapshot {
  readonly applications: number;
  readonly interviews: number;
  readonly offers: number;
  readonly strength: ProfileStrength;
}

export async function fetchCareerSnapshot(teacher: TeacherProfile): Promise<CareerSnapshot> {
  // Four small reads in parallel. Counts use head:true so no rows travel —
  // this runs on every Home load, often on a phone paying for the data.
  const [applications, cvDetails, experience, education, referees] = await Promise.all([
    supabase.from('applications').select('stage'),
    supabase.from('cv_details').select('summary').maybeSingle(),
    supabase.from('cv_experience').select('id', { count: 'exact', head: true }),
    supabase.from('cv_education').select('id', { count: 'exact', head: true }),
    supabase.from('cv_referees').select('id', { count: 'exact', head: true }),
  ]);

  const stages = (applications.data ?? []).map((a) => a.stage);

  return {
    applications: stages.length,
    // 'interview' is a stage, not a terminal state; someone who was
    // interviewed and then offered has passed through it either way.
    interviews: stages.filter((s) => s === 'interview' || s === 'offered').length,
    offers: stages.filter((s) => s === 'offered').length,
    strength: profileStrength(teacher, {
      hasSummary: (cvDetails.data?.summary ?? '').trim() !== '',
      experienceCount: experience.count ?? 0,
      educationCount: education.count ?? 0,
      refereeCount: referees.count ?? 0,
    }),
  };
}
