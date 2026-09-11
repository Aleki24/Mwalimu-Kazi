import type {
  CvCertificate, CvData, CvEducation, CvExperience, CvLanguage, CvReferee, CvStyle,
} from '@mwalimu/core';
import type { Tables, TablesInsert, TeacherProfile } from '@mwalimu/types';
import { DEFAULT_CV_STYLE, formatLabel, formatPhoneForDisplay, toE164Kenya } from '@mwalimu/core';
import { supabase } from './supabase';

/**
 * CV reads and writes. RLS scopes every table, so nothing here filters by user
 * id on reads — the database decides who may see what, and `visibility` on
 * `cv_details` is the teacher's half of that decision.
 */

export type EducationRow = Tables<'cv_education'>;
export type ExperienceRow = Tables<'cv_experience'>;
export type RefereeRow = Tables<'cv_referees'>;
export type CertificateRow = Tables<'cv_certificates'>;
export type LanguageRow = Tables<'cv_languages'>;

export interface CvRecord {
  readonly details: Tables<'cv_details'> | null;
  readonly education: readonly EducationRow[];
  readonly experience: readonly ExperienceRow[];
  readonly referees: readonly RefereeRow[];
  readonly certificates: readonly CertificateRow[];
  readonly languages: readonly LanguageRow[];
}

export const EMPTY_CV: CvRecord = {
  details: null, education: [], experience: [], referees: [], certificates: [], languages: [],
};

/**
 * One person's CV.
 *
 * `userId` is optional because the common case is your own, and RLS already
 * scopes an unfiltered read to you. Passing someone else's id is how a
 * recruiter or a parent reads an applicant's: the same query, refused by the
 * database unless that teacher's setting allows it.
 */
export async function fetchCv(userId?: string): Promise<CvRecord> {
  const scope = <T extends { eq: (column: string, value: string) => T }>(query: T): T =>
    (userId === undefined ? query : query.eq('user_id', userId));

  const [details, education, experience, referees, certificates, languages] = await Promise.all([
    scope(supabase.from('cv_details').select('*')).maybeSingle(),
    scope(supabase.from('cv_education').select('*')),
    scope(supabase.from('cv_experience').select('*')),
    scope(supabase.from('cv_referees').select('*').order('created_at')),
    scope(supabase.from('cv_certificates').select('*').order('created_at')),
    scope(supabase.from('cv_languages').select('*').order('created_at')),
  ]);

  for (const r of [details, education, experience, referees, certificates, languages]) {
    if (r.error !== null) throw new Error(r.error.message);
  }

  return {
    details: details.data,
    education: education.data ?? [],
    experience: experience.data ?? [],
    referees: referees.data ?? [],
    certificates: certificates.data ?? [],
    languages: languages.data ?? [],
  };
}

/**
 * The photograph, as a `data:` URI the document can carry with it.
 *
 * Downloaded and inlined rather than linked. The bucket is private, so a link
 * would be a signed URL with an expiry, and a CV whose photograph breaks a
 * week after it was emailed is worse than one that never had a photograph.
 *
 * A missing or unreadable photo is not an error worth stopping a CV for — the
 * document simply renders without one.
 */
export async function fetchPhotoDataUri(path: string | null): Promise<string | null> {
  if (path === null || path.trim() === '') return null;
  try {
    // A short-lived signed URL rather than `download()`, because of the CDN.
    // `download()` fetches a stable per-object URL, and Cloudflare answered it
    // with a cached copy — measured `cf-cache-status: HIT` — for a recruiter
    // who had opened the CV before the teacher set it to private, even with
    // `max-age=0` on the object. Signing produces a different URL every time,
    // so every fetch is a miss, and signing is itself refused once the policy
    // stops allowing it. Revocation is then immediate rather than up to an
    // hour late.
    const signed = await supabase.storage.from('cv-photos').createSignedUrl(path, 60);
    if (signed.error !== null || signed.data === null) return null;
    const response = await fetch(signed.data.signedUrl);
    if (!response.ok) return null;
    const data = await response.blob();
    const buffer = await data.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    // In chunks: `String.fromCharCode(...bytes)` on a two-megabyte photograph
    // is a stack overflow, not a slow path.
    for (let i = 0; i < bytes.length; i += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    const mime = data.type === '' ? 'image/jpeg' : data.type;
    return `data:${mime};base64,${globalThis.btoa(binary)}`;
  } catch {
    return null;
  }
}

/** `<user id>/portrait.jpg` — one photo per person, so a replace is an overwrite. */
export function photoPathFor(userId: string, extension: string): string {
  return `${userId}/portrait.${extension}`;
}

export async function uploadPhoto(
  userId: string, blob: Blob, extension: string,
): Promise<string> {
  const path = photoPathFor(userId, extension);
  const { error } = await supabase.storage.from('cv-photos')
    .upload(path, blob, {
      upsert: true,
      contentType: blob.type === '' ? 'image/jpeg' : blob.type,
      // Not cached, deliberately. Storage defaults to an hour, and an hour is
      // how long a recruiter kept being served a teacher's photograph after
      // that teacher set their CV to private — the policy refused a fresh
      // request, and the CDN answered the stale one anyway. A CV photograph is
      // fetched a handful of times in its life; re-authorising each time costs
      // nothing worth having.
      cacheControl: '0',
    });
  if (error !== null) throw new Error(error.message);
  return path;
}

export async function removePhoto(path: string): Promise<void> {
  const { error } = await supabase.storage.from('cv-photos').remove([path]);
  if (error !== null) throw new Error(error.message);
}

/** The teacher's own words for the date, not a locale's. "23 December 1996". */
export function formatDateOfBirth(iso: string | null): string | null {
  if (iso === null || iso.trim() === '') return null;
  const [year, month, day] = iso.split('-').map((p) => Number.parseInt(p, 10));
  if (year === undefined || month === undefined || day === undefined) return null;
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const name = MONTHS[month - 1];
  return name === undefined ? null : `${day} ${name} ${year}`;
}

/**
 * Fold the CV tables and the teacher's profile into what the renderer needs.
 *
 * Name, subjects, skills and TSC number come from the profile rather than
 * being typed again here: they are already the things the matcher uses, and a
 * CV that disagreed with the profile a school matched would be worse than no
 * CV.
 *
 * The photograph arrives already inlined — reading it is a network call, and
 * this has to stay a pure function so the preview can rebuild on every
 * keystroke without one.
 */
export function toCvData(
  teacher: Pick<TeacherProfile, 'fullName' | 'headline' | 'county' | 'tscNumber' | 'subjects' | 'skills'>,
  cv: CvRecord,
  photoDataUri: string | null = null,
): CvData {
  const trimmed = (v: string | null | undefined): string | null => {
    const t = (v ?? '').trim();
    return t === '' ? null : t;
  };

  const asExperience = (e: ExperienceRow): CvExperience => ({
    organisation: e.organisation,
    role: e.role,
    startYear: e.start_year,
    endYear: e.end_year,
    isCurrent: e.is_current,
    description: e.description,
  });

  const education: CvEducation[] = cv.education.map((e) => ({
    institution: e.institution,
    qualification: e.qualification,
    startYear: e.start_year,
    endYear: e.end_year,
    grade: e.grade,
  }));

  const referees: CvReferee[] = cv.referees.map((r) => ({
    name: r.name, title: r.title, organisation: r.organisation,
    phone: r.phone, email: r.email,
  }));

  const certificates: CvCertificate[] = cv.certificates.map((c) => ({
    title: c.title, description: c.description, year: c.year, isOngoing: c.is_ongoing,
  }));

  const languages: CvLanguage[] = cv.languages.map((l) => ({ name: l.name, level: l.level }));

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
    experience: cv.experience.filter((e) => !e.is_volunteer).map(asExperience),
    volunteer: cv.experience.filter((e) => e.is_volunteer).map(asExperience),
    referees,
    photoDataUri,
    dateOfBirth: formatDateOfBirth(cv.details?.date_of_birth ?? null),
    gender: trimmed(cv.details?.gender),
    nationality: trimmed(cv.details?.nationality),
    address: trimmed(cv.details?.address),
    postCode: trimmed(cv.details?.post_code),
    skills: teacher.skills,
    languages,
    hobbies: cv.details?.hobbies ?? [],
    responsibilities: cv.details?.responsibilities ?? [],
    certificates,
  };
}

/** Everything on `cv_details` a teacher may set from the CV screen. */
export type CvDetailsPatch = Partial<Pick<
  Tables<'cv_details'>,
  'summary' | 'email' | 'phone' | 'location' | 'address' | 'post_code'
  | 'date_of_birth' | 'gender' | 'nationality'
  | 'hobbies' | 'responsibilities' | 'visibility'
  | 'template' | 'accent' | 'font' | 'font_scale' | 'line_height'
  | 'entry_spacing' | 'section_spacing' | 'page_margins' | 'background'
>>;

export async function saveCvDetails(userId: string, patch: CvDetailsPatch): Promise<void> {
  const { error } = await supabase
    .from('cv_details')
    .upsert({ user_id: userId, ...patch, updated_at: new Date().toISOString() });
  if (error !== null) throw new Error(error.message);
}

/** Separate from the rest so a photo upload does not have to carry the form. */
export async function saveCvPhotoPath(userId: string, path: string | null): Promise<void> {
  const { error } = await supabase
    .from('cv_details')
    .upsert({ user_id: userId, photo_path: path, updated_at: new Date().toISOString() });
  if (error !== null) throw new Error(error.message);
}

/**
 * One typed upsert per table rather than one generic helper.
 *
 * A `Record<string, unknown>` version would be shorter and would accept a
 * misspelled column silently — the whole point of generating these types is
 * that the compiler catches that. Four small functions is the cheaper trade.
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

export async function saveCertificate(row: TablesInsert<'cv_certificates'>): Promise<void> {
  const { error } = await supabase.from('cv_certificates').upsert(row);
  if (error !== null) throw new Error(error.message);
}

export async function saveLanguage(row: TablesInsert<'cv_languages'>): Promise<void> {
  const { error } = await supabase.from('cv_languages').upsert(row);
  if (error !== null) throw new Error(error.message);
}

/**
 * The look the teacher chose, or the default one.
 *
 * Read out of the same row as the rest of the CV so that opening the preview
 * shows what they last set rather than what the template started as.
 */
export function toCvStyle(details: Tables<'cv_details'> | null): CvStyle {
  if (details === null) return DEFAULT_CV_STYLE;
  const scale = (n: number): CvStyle['fontScale'] =>
    (n >= 1 && n <= 5 ? (n as CvStyle['fontScale']) : 3);
  return {
    template: details.template,
    accent: details.accent,
    font: details.font,
    fontScale: scale(details.font_scale),
    lineHeight: scale(details.line_height),
    entrySpacing: scale(details.entry_spacing),
    sectionSpacing: scale(details.section_spacing),
    margins: scale(details.page_margins),
    background: details.background,
  };
}

/** The columns a `CvStyle` is stored in. One place, so the two cannot drift. */
export function styleColumns(style: CvStyle): CvDetailsPatch {
  return {
    template: style.template,
    accent: style.accent,
    font: style.font,
    font_scale: style.fontScale,
    line_height: style.lineHeight,
    entry_spacing: style.entrySpacing,
    section_spacing: style.sectionSpacing,
    page_margins: style.margins,
    background: style.background,
  };
}

export type CvTable =
  | 'cv_education' | 'cv_experience' | 'cv_referees' | 'cv_certificates' | 'cv_languages';

export async function deleteCvEntry(table: CvTable, id: string): Promise<void> {
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error !== null) throw new Error(error.message);
}

/**
 * Skills live on the profile, not on the CV.
 *
 * `profiles.skills` has existed since the first migration, is read by the
 * matcher and printed on the CV, and nothing in the app has ever been able to
 * set it — onboarding writes an empty array and no screen touches it since.
 * The CV editor is where a teacher is already listing what they can do, so it
 * is where the column finally gets filled; it writes to the profile so the CV
 * and the match cannot disagree.
 */
export async function saveSkills(userId: string, skills: readonly string[]): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ skills: [...skills], updated_at: new Date().toISOString() })
    .eq('id', userId);
  if (error !== null) throw new Error(error.message);
}
