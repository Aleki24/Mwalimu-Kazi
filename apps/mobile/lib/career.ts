import { profileStrength, type ProfileStrength } from '@mwalimu/core';
import type { Tables, TeacherProfile } from '@mwalimu/types';
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
  /**
   * The application that has travelled furthest, for the hero card. Null when
   * a teacher has not applied to anything yet — the hero then has nothing
   * truthful to say and the screen shows something else instead.
   */
  readonly lead: LeadApplication | null;
}

/** The one application worth putting at the top of Home. */
export interface LeadApplication {
  readonly id: string;
  readonly stage: Tables<'applications'>['stage'];
  readonly jobId: string;
  readonly jobTitle: string;
  readonly schoolName: string;
  readonly appliedAt: Date;
}

/**
 * How far each stage has got, for picking the lead. Deliberately NOT the
 * pipeline mapping in `components/pipeline`: this one has to rank all eight
 * stages against each other, including the two that end an application, so it
 * is an ordering rather than a position. A rejection sorts below everything
 * live, because a closed application is not the thing to greet someone with.
 */
const STAGE_RANK: Readonly<Record<Tables<'applications'>['stage'], number>> = {
  offered: 6,
  interview: 5,
  shortlisted: 4,
  viewed: 3,
  applied: 2,
  saved: 1,
  rejected: 0,
  withdrawn: 0,
};

export async function fetchCareerSnapshot(teacher: TeacherProfile): Promise<CareerSnapshot> {
  // Four small reads in parallel. Counts use head:true so no rows travel —
  // this runs on every Home load, often on a phone paying for the data.
  const [applications, cvDetails, experience, education, referees] = await Promise.all([
    supabase
      .from('applications')
      .select('id, stage, created_at, job_id, jobs ( title, schools ( name ) )'),
    supabase.from('cv_details').select('summary').maybeSingle(),
    supabase.from('cv_experience').select('id', { count: 'exact', head: true }),
    supabase.from('cv_education').select('id', { count: 'exact', head: true }),
    supabase.from('cv_referees').select('id', { count: 'exact', head: true }),
  ]);

  const rows = applications.data ?? [];
  const stages = rows.map((a) => a.stage);

  return {
    lead: pickLead(rows),
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

/** The row shape the snapshot query returns for the embedded job and school. */
interface ApplicationRow {
  readonly id: string;
  readonly stage: Tables<'applications'>['stage'];
  readonly created_at: string;
  readonly job_id: string;
  readonly jobs: { readonly title: string; readonly schools: { readonly name: string } | null } | null;
}

/**
 * The furthest-along application, breaking ties by recency.
 *
 * A row whose job did not come back is skipped rather than shown with a blank
 * school: the hero card names a school out loud, and naming the wrong one — or
 * none — is worse than showing the fallback.
 */
function pickLead(rows: readonly unknown[]): LeadApplication | null {
  let best: LeadApplication | null = null;
  let bestRank = -1;

  for (const raw of rows) {
    const row = raw as ApplicationRow;
    const job = row.jobs;
    if (job === null || job.schools === null) continue;

    const rank = STAGE_RANK[row.stage];
    const appliedAt = new Date(row.created_at);
    if (rank < bestRank) continue;
    if (rank === bestRank && best !== null && appliedAt <= best.appliedAt) continue;

    bestRank = rank;
    best = {
      id: row.id,
      stage: row.stage,
      jobId: row.job_id,
      jobTitle: job.title,
      schoolName: job.schools.name,
      appliedAt,
    };
  }

  return best;
}
