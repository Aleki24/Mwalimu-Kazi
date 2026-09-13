import type { Tables, TablesInsert } from '@mwalimu/types';
import { supabase } from './supabase';

/**
 * The other half of the tuition market.
 *
 * A request is a parent saying what they need; a tutor profile is a teacher
 * saying what they offer. Until this existed the market only ran one way —
 * parents posted and waited, and a teacher who tutors for a living could not
 * be looked up at all.
 */

export type TutorRow = Tables<'tutor_profiles'>;

/** One card in the directory. Deliberately not the whole profile row. */
export interface Tutor {
  readonly userId: string;
  readonly fullName: string;
  readonly headline: string | null;
  readonly about: string | null;
  readonly subjects: readonly string[];
  readonly learnerLevels: readonly string[];
  readonly county: string | null;
  readonly area: string | null;
  readonly meetsOnline: boolean;
  readonly meetsAtStudent: boolean;
  readonly meetsAtTeacher: boolean;
  readonly rateMin: number | null;
  readonly rateMax: number | null;
  readonly ratePeriod: TutorRow['rate_period'];
  readonly gender: string | null;
  readonly experienceYears: number;
  readonly tscVerified: boolean;
}

export interface TutorFilter {
  readonly subject?: string;
  readonly county?: string;
  readonly online?: boolean;
  readonly atStudent?: boolean;
  readonly search?: string;
}

/**
 * Read through the function, never the table.
 *
 * `profiles` has no policy letting a parent read a teacher's row, and adding
 * one would hand over their TSC number and their settings along with the name.
 * `find_tutors` returns exactly the card and nothing else.
 */
export async function findTutors(filter: TutorFilter = {}): Promise<readonly Tutor[]> {
  const { data, error } = await supabase.rpc('find_tutors', {
    // Undefined rather than null for the ones left out: the function treats
    // null as "do not mind", and sending `false` for "online" would ask for
    // tutors who cannot teach online, which nobody wants.
    ...(filter.subject === undefined ? {} : { p_subject: filter.subject }),
    ...(filter.county === undefined ? {} : { p_county: filter.county }),
    ...(filter.online === true ? { p_online: true } : {}),
    ...(filter.atStudent === true ? { p_at_student: true } : {}),
    ...(filter.search === undefined || filter.search.trim() === ''
      ? {} : { p_search: filter.search.trim() }),
  });
  if (error !== null) throw new Error(error.message);
  return (data ?? []).map((t): Tutor => ({
    userId: t.user_id,
    fullName: t.full_name,
    headline: t.headline,
    about: t.about,
    subjects: t.subjects ?? [],
    learnerLevels: t.learner_levels ?? [],
    county: t.county,
    area: t.area,
    meetsOnline: t.meets_online,
    meetsAtStudent: t.meets_at_student,
    meetsAtTeacher: t.meets_at_teacher,
    rateMin: t.rate_min,
    rateMax: t.rate_max,
    ratePeriod: t.rate_period,
    gender: t.gender,
    experienceYears: t.experience_years,
    tscVerified: t.tsc_verified,
  }));
}

export async function fetchTutor(userId: string): Promise<Tutor | null> {
  const found = await findTutors();
  const direct = await supabase.rpc('find_tutors', { p_tutor: userId });
  if (direct.error !== null) throw new Error(direct.error.message);
  const row = (direct.data ?? [])[0];
  if (row === undefined) return found.find((t) => t.userId === userId) ?? null;
  return {
    userId: row.user_id,
    fullName: row.full_name,
    headline: row.headline,
    about: row.about,
    subjects: row.subjects ?? [],
    learnerLevels: row.learner_levels ?? [],
    county: row.county,
    area: row.area,
    meetsOnline: row.meets_online,
    meetsAtStudent: row.meets_at_student,
    meetsAtTeacher: row.meets_at_teacher,
    rateMin: row.rate_min,
    rateMax: row.rate_max,
    ratePeriod: row.rate_period,
    gender: row.gender,
    experienceYears: row.experience_years,
    tscVerified: row.tsc_verified,
  };
}

/** Your own row, switched off or not — the table policy scopes it to you. */
export async function fetchMyTutorProfile(): Promise<TutorRow | null> {
  const { data, error } = await supabase.from('tutor_profiles').select('*').maybeSingle();
  if (error !== null) throw new Error(error.message);
  return data;
}

export async function saveTutorProfile(row: TablesInsert<'tutor_profiles'>): Promise<void> {
  const { error } = await supabase
    .from('tutor_profiles')
    .upsert({ ...row, updated_at: new Date().toISOString() });
  if (error !== null) throw new Error(error.message);
}

/**
 * Reach out to a tutor about one of your listings.
 *
 * Returns the thread, so the screen can drop the parent straight into writing
 * the first message — which is the whole point of getting in touch, and is
 * also what tells the teacher it happened.
 */
export async function inviteTutor(jobId: string, tutorId: string): Promise<string> {
  const { data, error } = await supabase.rpc('invite_tutor', {
    p_job: jobId, p_tutor: tutorId,
  });
  if (error !== null) throw new Error(error.message);
  if (data === null) throw new Error('Could not start that conversation');
  return data;
}
