import { matchScore, parseJob, parseTeacherProfile, type MatchResult } from '@mwalimu/core';
import type { County, Curriculum, SchoolType, Tables, TeacherProfile } from '@mwalimu/types';
import { supabase } from './supabase';

/**
 * The school side.
 *
 * A recruiter is not a separate account type — a head of department is often
 * also a teacher looking for their next role. Membership of a school is a fact
 * about a person, not a different login.
 */

export interface MySchool {
  readonly school: Tables<'schools'>;
  readonly role: Tables<'school_members'>['role'];
  readonly openRoles: number;
  readonly newApplicants: number;
}

/** Schools this person recruits for. RLS scopes the membership read. */
export async function fetchMySchools(): Promise<readonly MySchool[]> {
  const { data, error } = await supabase
    .from('school_members')
    .select('role, schools ( * )');
  if (error !== null) throw new Error(error.message);

  const rows = (data ?? []) as unknown as ReadonlyArray<{
    role: Tables<'school_members'>['role'];
    schools: Tables<'schools'> | null;
  }>;
  const schools = rows.flatMap((r) => (r.schools === null ? [] : [{ row: r.schools, role: r.role }]));
  if (schools.length === 0) return [];

  const ids = schools.map((s) => s.row.id);
  const [jobs, applications] = await Promise.all([
    supabase.from('jobs').select('id, school_id').in('school_id', ids).eq('published', true),
    // RLS already limits this to applications for jobs at schools you belong
    // to, so no school filter is needed — and adding one would not make it
    // safer, only slower.
    supabase.from('applications').select('job_id, stage'),
  ]);

  const jobsBySchool = new Map<string, string[]>();
  for (const j of jobs.data ?? []) {
    if (j.school_id === null) continue;
    jobsBySchool.set(j.school_id, [...(jobsBySchool.get(j.school_id) ?? []), j.id]);
  }
  // 'applied' is the unreviewed stage: nobody at the school has looked yet.
  const countsByJob = new Map<string, number>();
  for (const a of applications.data ?? []) {
    if (a.stage !== 'applied') continue;
    countsByJob.set(a.job_id, (countsByJob.get(a.job_id) ?? 0) + 1);
  }

  return schools.map(({ row, role }) => {
    const jobIds = jobsBySchool.get(row.id) ?? [];
    return {
      school: row,
      role,
      openRoles: jobIds.length,
      newApplicants: jobIds.reduce((sum, id) => sum + (countsByJob.get(id) ?? 0), 0),
    };
  });
}

/**
 * One school, with this person's standing at it.
 *
 * fetchMySchools answers "where do I recruit"; this answers "what am I allowed
 * to do here", which the school screen needs and a list of every school would
 * be a wasteful way to get.
 */
export async function fetchMySchool(schoolId: string): Promise<MySchool | null> {
  const { data, error } = await supabase
    .from('school_members').select('role, schools ( * )')
    .eq('school_id', schoolId).maybeSingle();
  if (error !== null) throw new Error(error.message);

  const row = data as unknown as {
    role: Tables<'school_members'>['role'];
    schools: Tables<'schools'> | null;
  } | null;
  if (row === null || row.schools === null) return null;

  // openRoles and newApplicants belong to the dashboard's summary, and this
  // caller has the real numbers in front of it. Zero rather than a second
  // round trip to compute something nothing reads.
  return { school: row.schools, role: row.role, openRoles: 0, newApplicants: 0 };
}

export async function createSchool(input: {
  readonly name: string;
  readonly county: County;
  readonly schoolType: SchoolType;
  readonly curricula: readonly Curriculum[];
}): Promise<string> {
  const { data, error } = await supabase.rpc('create_school', {
    p_name: input.name,
    p_county: input.county,
    p_school_type: input.schoolType,
    p_curricula: [...input.curricula],
  });
  if (error !== null) throw new Error(error.message);
  return data;
}

export interface SchoolRole {
  readonly job: Tables<'jobs'>;
  readonly applicants: number;
  readonly newApplicants: number;
}

/** Every role at this school, published or not — a draft is still yours. */
export async function fetchSchoolRoles(schoolId: string): Promise<readonly SchoolRole[]> {
  const [jobs, applications] = await Promise.all([
    supabase.from('jobs').select('*').eq('school_id', schoolId)
      .order('posted_at', { ascending: false }),
    supabase.from('applications').select('job_id, stage'),
  ]);
  if (jobs.error !== null) throw new Error(jobs.error.message);

  const all = new Map<string, number>();
  const fresh = new Map<string, number>();
  for (const a of applications.data ?? []) {
    all.set(a.job_id, (all.get(a.job_id) ?? 0) + 1);
    if (a.stage === 'applied') fresh.set(a.job_id, (fresh.get(a.job_id) ?? 0) + 1);
  }

  return (jobs.data ?? []).map((job) => ({
    job,
    applicants: all.get(job.id) ?? 0,
    newApplicants: fresh.get(job.id) ?? 0,
  }));
}

export interface Applicant {
  readonly application: Tables<'applications'>;
  /** Null when the profile could not be read or parsed — never a half-built one. */
  readonly teacher: TeacherProfile | null;
  /** Scored live against the job, alongside the frozen score they applied with. */
  readonly liveMatch: MatchResult | null;
}

/**
 * Applicants for one role.
 *
 * Two match numbers are surfaced deliberately. `application.match_score` is
 * what the teacher's profile said when they applied, and it is client-asserted
 * so it must not be trusted for ranking. `liveMatch` is recomputed here from
 * the profile as it stands, by the same matcher the teacher saw. Where they
 * disagree, the live one is the honest number.
 */
export async function fetchApplicants(
  job: Tables<'jobs'>,
): Promise<readonly Applicant[]> {
  const { data, error } = await supabase
    .from('applications')
    .select('*, profiles ( * )')
    .eq('job_id', job.id)
    .order('created_at', { ascending: false });
  if (error !== null) throw new Error(error.message);

  const parsedJob = parseJob(job);

  return (data ?? []).map((row) => {
    const joined = row as unknown as Tables<'applications'> & {
      profiles: Tables<'profiles'> | null;
    };
    const profile = joined.profiles === null ? null : parseTeacherProfile(joined.profiles);
    const teacher = profile !== null && profile.ok ? profile.value : null;
    return {
      application: joined,
      teacher,
      liveMatch: teacher !== null && parsedJob.ok ? matchScore(parsedJob.value, teacher) : null,
    };
  });
}

/**
 * Listings this person posted in their own name, newest first.
 *
 * The hiring side of the app has two shapes, and they share everything below
 * this point: a school's vacancies come from fetchSchoolRoles, and a person's
 * own postings — a locum a head of department needed by Monday, or a parent
 * looking for a tutor — come from here. Both hand a job row to
 * fetchApplicants, so who answered and what to do about them is one code path
 * rather than two that drift.
 */
export async function fetchMyPostings(posterId: string): Promise<readonly Tables<'jobs'>[]> {
  const { data, error } = await supabase
    .from('jobs').select('*')
    .eq('posted_by', posterId)
    .is('school_id', null)
    .order('posted_at', { ascending: false });
  // The posted_by filter is not optional. jobs_select_published makes every
  // published listing readable by everyone, so filtering on school_id alone
  // would have returned every individual listing in the country as if it were
  // this person's own — which is what the first draft of this function did.
  if (error !== null) throw new Error(error.message);
  return data ?? [];
}

/**
 * What a school attaches to a decision.
 *
 * Optional because most stages need nothing — shortlisting somebody is the
 * whole message. An interview and a rejection are the two that are useless on
 * their own, and `decisionNeedsDetail` in @mwalimu/core is what says so, in
 * one place, so the screen and the check cannot drift apart.
 */
export interface Decision {
  readonly note?: string | undefined;
  /** ISO 8601. The database formats it in Africa/Nairobi for the notification. */
  readonly interviewAt?: string | undefined;
  readonly interviewPlace?: string | undefined;
}

const trimmedOrNull = (value: string | undefined): string | null => {
  const text = (value ?? '').trim();
  return text === '' ? null : text;
};

/**
 * Move somebody along, and say something while doing it.
 *
 * The notification is not sent from here. A trigger on `applications` writes
 * it, because a school holds UPDATE on this row and a client-written
 * notification is both forgeable and one refactor away from being forgotten.
 * This function's only job is the record; the telling follows from it.
 */
export async function setApplicationStage(
  applicationId: string,
  stage: Tables<'applications'>['stage'],
  decision?: Decision,
): Promise<void> {
  const patch = decision === undefined
    ? { stage }
    : {
        stage,
        decision_note: trimmedOrNull(decision.note),
        interview_at: trimmedOrNull(decision.interviewAt),
        interview_place: trimmedOrNull(decision.interviewPlace),
      };

  const { error } = await supabase
    .from('applications').update(patch).eq('id', applicationId);
  if (error !== null) throw new Error(error.message);
}

/**
 * Ask the platform to check this school.
 *
 * `verification` is guarded: a school cannot mark itself verified, and until
 * now it could not ask either, so the moderator's queue could only ever be
 * filled by hand in SQL. The guard now allows exactly one move — unverified to
 * under_review, by the school's own admin — which is asking, not granting.
 */
export async function requestSchoolVerification(schoolId: string): Promise<void> {
  const { error } = await supabase
    .from('schools').update({ verification: 'under_review' }).eq('id', schoolId);
  if (error !== null) throw new Error(error.message);
}
