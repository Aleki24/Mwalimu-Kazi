import type { CvData, CvEducation, CvExperience, CvReferee } from '@mwalimu/core';
import type { Tables, TablesInsert, TeacherProfile } from '@mwalimu/types';
import { formatLabel, formatPhoneForDisplay, toE164Kenya } from '@mwalimu/core';
import { supabase } from './supabase';

/**
 * CV reads and writes. RLS scopes every table to the owner, so nothing here
 * filters by user id on reads — the database does it.
 */

export type EducationRow = Tables<'cv_education'>;
export type ExperienceRow = Tables<'cv_experience'>;
export type RefereeRow = Tables<'cv_referees'>;

export interface CvRecord {
  readonly details: Tables<'cv_details'> | null;
  readonly education: readonly EducationRow[];
  readonly experience: readonly ExperienceRow[];
  readonly referees: readonly RefereeRow[];
}

export async function fetchCv(): Promise<CvRecord> {
  const [details, education, experience, referees] = await Promise.all([
    supabase.from('cv_details').select('*').maybeSingle(),
    supabase.from('cv_education').select('*'),
    supabase.from('cv_experience').select('*'),
    supabase.from('cv_referees').select('*').order('created_at'),
  ]);

  for (const r of [details, education, experience, referees]) {
    if (r.error !== null) throw new Error(r.error.message);
  }

  return {
    details: details.data,
    education: education.data ?? [],
    experience: experience.data ?? [],
    referees: referees.data ?? [],
  };
}

/**
 * Fold the CV tables and the teacher's profile into what the renderer needs.
 *
 * Name, subjects and TSC number come from the profile rather than being typed
 * again here: they are already the things the matcher uses, and a CV that
 * disagreed with the profile a school matched would be worse than no CV.
 */
export function toCvData(teacher: TeacherProfile, cv: CvRecord): CvData {
  const trimmed = (v: string | null | undefined): string | null => {
    const t = (v ?? '').trim();
    return t === '' ? null : t;
  };

  const education: CvEducation[] = cv.education.map((e) => ({
    institution: e.institution,
    qualification: e.qualification,
    startYear: e.start_year,
    endYear: e.end_year,
    grade: e.grade,
  }));

  const experience: CvExperience[] = cv.experience.map((e) => ({
    organisation: e.organisation,
    role: e.role,
    startYear: e.start_year,
    endYear: e.end_year,
    isCurrent: e.is_current,
    description: e.description,
  }));

  const referees: CvReferee[] = cv.referees.map((r) => ({
    name: r.name, title: r.title, organisation: r.organisation,
    phone: r.phone, email: r.email,
  }));

  return {
    fullName: teacher.fullName,
    headline: trimmed(teacher.headline),
    summary: trimmed(cv.details?.summary),
    email: trimmed(cv.details?.email),
    // Normalised for the document, not for storage. A teacher types
    // "0712345678" or "+254712345678" depending on habit; both should print
    // the same way on a CV an employer reads. Anything that does not parse as
    // a Kenyan number is printed exactly as typed — a foreign number is not an
    // error, it is just not ours to reformat.
    phone: (() => {
      const raw = trimmed(cv.details?.phone);
      if (raw === null) return null;
      const parsed = toE164Kenya(raw);
      return parsed.ok ? formatPhoneForDisplay(parsed.e164) : raw;
    })(),
    // Falls back to the county on the profile, so the header is never blank
    // just because someone skipped one optional field.
    location: trimmed(cv.details?.location) ?? formatLabel(teacher.county),
    tscNumber: trimmed(teacher.tscNumber),
    subjects: teacher.subjects.map(formatLabel),
    education,
    experience,
    referees,
  };
}

export async function saveCvDetails(
  userId: string,
  patch: Partial<Pick<Tables<'cv_details'>, 'summary' | 'email' | 'phone' | 'location'>>,
): Promise<void> {
  const { error } = await supabase
    .from('cv_details')
    .upsert({ user_id: userId, ...patch, updated_at: new Date().toISOString() });
  if (error !== null) throw new Error(error.message);
}

/**
 * One typed upsert per table rather than one generic helper.
 *
 * A `Record<string, unknown>` version would be shorter and would accept a
 * misspelled column silently — the whole point of generating these types is
 * that the compiler catches that. Three small functions is the cheaper trade.
 * Supabase upserts on the primary key, so omitting `id` inserts and supplying
 * one updates.
 */
export async function saveEducation(row: TablesInsert<'cv_education'>): Promise<void> {
  const { error } = await supabase.from('cv_education').upsert(row);
  if (error !== null) throw new Error(error.message);
}

export async function saveExperience(row: TablesInsert<'cv_experience'>): Promise<void> {
  const { error } = await supabase.from('cv_experience').upsert(row);
  if (error !== null) throw new Error(error.message);
}

export async function saveReferee(row: TablesInsert<'cv_referees'>): Promise<void> {
  const { error } = await supabase.from('cv_referees').upsert(row);
  if (error !== null) throw new Error(error.message);
}

export type CvTable = 'cv_education' | 'cv_experience' | 'cv_referees';

export async function deleteCvEntry(table: CvTable, id: string): Promise<void> {
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error !== null) throw new Error(error.message);
}
