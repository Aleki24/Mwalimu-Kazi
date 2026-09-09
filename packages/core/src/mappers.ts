import { z } from 'zod';
import {
  Curriculum, Job, JobRequirement, School, SchoolType, TeacherProfile, type Tables,
} from '@mwalimu/types';
import type { JobWithSchool } from './job-query';

/**
 * Database rows to domain objects.
 *
 * Pure and dependency-free so it can be tested without a database, and so the
 * mobile app and the recruiter dashboard read rows identically.
 */

export type ParseResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly reason: string };

const Requirements = z.array(JobRequirement);

function salaryBand(min: number | null, max: number | null): Job['salary'] {
  if (min === null && max === null) return undefined;
  // A lone ceiling with no floor is not a band we can reason about; treat the
  // single figure as the floor rather than inventing a minimum of zero, which
  // would let it clear any Auto-Apply salary rule.
  const floor = min ?? max;
  if (floor === null) return undefined;
  return max !== null && max !== floor ? { min: floor, max } : { min: floor };
}

/**
 * Parse a job row.
 *
 * Requirements are validated STRICTLY and a malformed set fails the whole row.
 * The tempting alternative — drop the entries that will not parse — silently
 * raises the match score by removing requirements the teacher does not meet,
 * and a dropped `mustHave` would let Auto-Apply send an application that every
 * rule was supposed to block. A job we cannot score correctly must not be
 * scored at all.
 */
export function parseJob(row: Tables<'jobs'>): ParseResult<Job> {
  const requirements = Requirements.safeParse(row.requirements);
  if (!requirements.success) {
    return { ok: false, reason: `job ${row.id}: malformed requirements` };
  }

  const job = Job.safeParse({
    id: row.id,
    schoolId: row.school_id,
    title: row.title,
    subjects: row.subjects,
    jobType: row.job_type,
    county: row.county,
    salary: salaryBand(row.salary_min, row.salary_max),
    ratePeriod: row.rate_period,
    requirements: requirements.data,
    postedAt: row.posted_at,
    closesAt: row.closes_at ?? undefined,
    engagement: row.engagement,
    delivery: row.delivery ?? undefined,
    area: row.area ?? undefined,
    learnerLevel: row.learner_level ?? undefined,
    sessionsPerWeek: row.sessions_per_week ?? undefined,
  });

  return job.success
    ? { ok: true, value: job.data }
    : { ok: false, reason: `job ${row.id}: ${job.error.issues[0]?.message ?? 'invalid'}` };
}

export function parseSchool(row: Tables<'schools'>): ParseResult<School> {
  const school = School.safeParse({
    id: row.id,
    name: row.name,
    slug: row.slug,
    county: row.county,
    schoolType: row.school_type,
    curricula: row.curricula,
    verification: row.verification,
    teacherCount: row.teacher_count ?? undefined,
  });
  return school.success
    ? { ok: true, value: school.data }
    : { ok: false, reason: `school ${row.id}: ${school.error.issues[0]?.message ?? 'invalid'}` };
}

export function parseTeacherProfile(row: Tables<'profiles'>): ParseResult<TeacherProfile> {
  const profile = TeacherProfile.safeParse({
    id: row.id,
    fullName: row.full_name,
    headline: row.headline ?? undefined,
    county: row.county,
    subjects: row.subjects,
    curricula: row.curricula,
    experienceYears: row.experience_years,
    hasDegree: row.has_degree,
    tscNumber: row.tsc_number ?? undefined,
    tscVerified: row.tsc_verified,
    openToOpportunities: row.open_to_opportunities,
    notificationSound: row.notification_sound,
    skills: row.skills,
  });
  return profile.success
    ? { ok: true, value: profile.data }
    : { ok: false, reason: `profile ${row.id}: ${profile.error.issues[0]?.message ?? 'invalid'}` };
}

/** A job row joined to its school, as the jobs list selects it. */
export interface JobRowWithSchool extends Tables<'jobs'> {
  readonly schools:
    Pick<Tables<'schools'>, 'name' | 'slug' | 'school_type' | 'curricula' | 'verification'> | null;
}

/**
 * Map a joined row. Rows that cannot be parsed are reported rather than
 * silently dropped, so a data problem shows up instead of quietly shrinking
 * the results.
 */
export function parseJobsWithSchools(
  rows: readonly JobRowWithSchool[],
): { readonly jobs: readonly JobWithSchool[]; readonly skipped: readonly string[] } {
  const jobs: JobWithSchool[] = [];
  const skipped: string[] = [];

  for (const row of rows) {
    const parsed = parseJob(row);
    if (!parsed.ok) {
      skipped.push(parsed.reason);
      continue;
    }

    // Since 0008 a job need not belong to a school. Dropping those rows here
    // — which is what "missing school" used to do — would have made every
    // individually posted job invisible in every list, with nothing failing.
    if (row.schools === null) {
      if (row.school_id !== null) {
        // A school_id that did not resolve IS a data problem, and still gets
        // reported rather than quietly rendered as an independent listing.
        skipped.push(`job ${row.id}: school ${row.school_id} did not resolve`);
        continue;
      }
      jobs.push({
        job: parsed.value,
        schoolName: 'Independent listing',
        schoolSlug: null,
        schoolType: null,
        schoolCurricula: [],
        schoolVerification: null,
        posterKind: row.poster_kind,
      });
      continue;
    }

    const curricula = z.array(Curriculum).safeParse(row.schools.curricula);
    const schoolType = SchoolType.safeParse(row.schools.school_type);
    if (!curricula.success || !schoolType.success) {
      skipped.push(`job ${row.id}: unrecognised school vocabulary`);
      continue;
    }
    jobs.push({
      job: parsed.value,
      schoolName: row.schools.name,
      schoolSlug: row.schools.slug,
      schoolType: schoolType.data,
      schoolCurricula: curricula.data,
      schoolVerification: row.schools.verification,
      posterKind: row.poster_kind,
    });
  }

  return { jobs, skipped };
}
