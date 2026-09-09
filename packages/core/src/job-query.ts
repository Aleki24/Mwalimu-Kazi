import type { EngagementKind,
  Curriculum, County, Job, JobPosterKind, JobType, SchoolType, TeacherProfile,
  VerificationStatus,
} from '@mwalimu/types';
import { matchScore, type MatchResult } from './match';

/**
 * Job search: the filter set behind the Jobs screen, and the ranking that
 * decides what a teacher sees first.
 *
 * Filtering is separated from ranking on purpose - a filter is the teacher's
 * explicit instruction and must be obeyed exactly, while ranking is our opinion
 * about ordering and must never remove a job they asked to see.
 */

export interface JobFilters {
  readonly subjects?: readonly string[];
  readonly curricula?: readonly Curriculum[];
  readonly counties?: readonly County[];
  readonly jobTypes?: readonly JobType[];
  readonly schoolTypes?: readonly SchoolType[];
  /** Minimum acceptable monthly pay, in whole shillings. */
  readonly minSalary?: number;
  readonly maxExperienceYears?: number;
  /** Hide roles that do not require TSC registration. */
  readonly tscOnly?: boolean;
  /**
   * Employment, private tuition, homeschooling. Absent means all of them —
   * a teacher browsing for work is usually open to either.
   */
  readonly engagements?: readonly EngagementKind[];
  readonly query?: string;
}

/** Fields a job needs beyond `Job` itself to be filterable by school. */
export interface JobWithSchool {
  readonly job: Job;
  /** The school's name, or a label for a listing that has no school. */
  readonly schoolName: string;
  /**
   * Null for a listing with no school. Carried so a vacancy can link to the
   * school's page: a teacher reading the reviews before applying is the whole
   * pitch, and the job screen is where they are standing when they want them.
   */
  readonly schoolSlug: string | null;
  /**
   * Null for a job posted by an individual. Since 0008 a listing need not
   * belong to a school, and a missing school is not the same as an unknown
   * one — a school-type filter must exclude these rather than guess.
   */
  readonly schoolType: SchoolType | null;
  readonly schoolCurricula: readonly Curriculum[];
  /**
   * Null for a listing with no school. Carried all the way to the job card
   * because a teacher deciding whether to send their documents is the person
   * who needs to know the school has not been checked — the schools directory
   * already says so, and the vacancy is where the decision actually happens.
   */
  readonly schoolVerification: VerificationStatus | null;
  readonly posterKind: JobPosterKind;
}

const norm = (s: string): string => s.trim().toLowerCase();
const overlaps = (a: readonly string[], b: readonly string[]): boolean =>
  a.some((x) => b.some((y) => norm(x) === norm(y)));

/** The years-of-experience bar a job sets, or null when it sets none. */
export function requiredExperience(job: Job): number | null {
  const req = job.requirements.find((r) => r.kind === 'experience_years');
  if (req === undefined) return null;
  const years = Number.parseInt(req.value, 10);
  return Number.isFinite(years) ? years : null;
}

export function requiresTsc(job: Job): boolean {
  return job.requirements.some((r) => r.kind === 'tsc_registration');
}

function matchesQuery(entry: JobWithSchool, query: string): boolean {
  const q = norm(query);
  if (q === '') return true;
  return (
    norm(entry.job.title).includes(q) ||
    norm(entry.schoolName).includes(q) ||
    entry.job.subjects.some((s) => norm(s).includes(q))
  );
}

/** Apply every supplied filter. An omitted filter is not a constraint. */
export function filterJobs(
  entries: readonly JobWithSchool[],
  filters: JobFilters,
): readonly JobWithSchool[] {
  return entries.filter((entry) => {
    const { job } = entry;

    if (filters.subjects?.length && !overlaps(job.subjects, filters.subjects)) return false;
    if (filters.counties?.length && !filters.counties.some((c) => norm(c) === norm(job.county))) return false;
    if (filters.jobTypes?.length && !filters.jobTypes.includes(job.jobType)) return false;
    if (filters.engagements?.length && !filters.engagements.includes(job.engagement)) return false;
    // A school-type filter is a question about schools. A listing with no
    // school cannot answer it, so it is excluded rather than let through.
    if (filters.schoolTypes?.length
      && (entry.schoolType === null || !filters.schoolTypes.includes(entry.schoolType))) return false;
    if (filters.curricula?.length && !overlaps(entry.schoolCurricula, filters.curricula)) return false;

    if (filters.minSalary !== undefined) {
      // A job with no advertised salary is KEPT here, unlike in Auto-Apply.
      // Browsing is reversible - the teacher can read the listing and decide -
      // whereas an automatic application cannot be taken back.
      if (job.salary !== undefined) {
        const ceiling = job.salary.max ?? job.salary.min;
        if (ceiling < filters.minSalary) return false;
      }
    }

    if (filters.maxExperienceYears !== undefined) {
      const required = requiredExperience(job);
      if (required !== null && required > filters.maxExperienceYears) return false;
    }

    if (filters.tscOnly === true && !requiresTsc(job)) return false;
    if (filters.query !== undefined && !matchesQuery(entry, filters.query)) return false;

    return true;
  });
}

export interface RankedJob extends JobWithSchool {
  readonly match: MatchResult;
}

/**
 * Rank by match score, then by how soon the role closes, then by recency.
 *
 * Closing date beats recency deliberately: the whole problem this product
 * exists to solve is teachers hearing about a vacancy after the shortlist has
 * closed.
 */
export function rankJobs(
  entries: readonly JobWithSchool[],
  teacher: TeacherProfile,
  now: Date,
): readonly RankedJob[] {
  const ranked = entries.map((entry) => ({ ...entry, match: matchScore(entry.job, teacher) }));

  return ranked.sort((a, b) => {
    if (b.match.score !== a.match.score) return b.match.score - a.match.score;

    const aCloses = a.job.closesAt?.getTime() ?? Number.POSITIVE_INFINITY;
    const bCloses = b.job.closesAt?.getTime() ?? Number.POSITIVE_INFINITY;
    if (aCloses !== bCloses) return aCloses - bCloses;

    return b.job.postedAt.getTime() - a.job.postedAt.getTime();
  }).filter((entry) => entry.job.closesAt === undefined || entry.job.closesAt.getTime() > now.getTime());
}

/** Roles closing within `hours`, for the "closing soon" prompt on Home. */
export function closingSoon(
  entries: readonly JobWithSchool[],
  now: Date,
  hours = 24,
): readonly JobWithSchool[] {
  const cutoff = now.getTime() + hours * 60 * 60 * 1000;
  return entries.filter((e) => {
    const closes = e.job.closesAt?.getTime();
    return closes !== undefined && closes > now.getTime() && closes <= cutoff;
  });
}
