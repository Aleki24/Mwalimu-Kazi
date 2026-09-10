import { z } from 'zod';
import {
  ApplicationSource, ApplicationStage, County, Curriculum, JobType, ModerationStatus,
  RedFlagKind, RequirementKind, ReviewCategory, SchoolType, VerificationStatus,
  EngagementKind, GenderPreference, PosterRole, RatePeriod, TeachingLevel,
} from './enums';

export const Uuid = z.string().uuid();
export const Slug = z.string().min(1).max(64).regex(/^[a-z0-9-]+$/);

/** Kenyan Shillings, whole shillings only - never floats for money. */
export const Kes = z.number().int().nonnegative();

/**
 * A monthly pay band. `min` may exceed nothing and `max` may be absent when a
 * school only advertises a floor, but an inverted band is always a data bug.
 */
export const SalaryBand = z.object({
  min: Kes,
  max: Kes.optional(),
}).refine((b) => b.max === undefined || b.max >= b.min, {
  message: 'salary max must be greater than or equal to min',
});
export type SalaryBand = z.infer<typeof SalaryBand>;

// --- Teacher -------------------------------------------------------------

/**
 * A teacher's TSC number. The Teachers Service Commission issues numeric
 * registration numbers; we store the digits and verify separately.
 */
export const TscNumber = z.string().regex(/^\d{4,9}$/, 'TSC number must be 4-9 digits');

export const TeacherProfile = z.object({
  id: Uuid,
  fullName: z.string().min(2).max(120),
  headline: z.string().max(160).optional(),
  county: County,
  subjects: z.array(Slug).min(1),
  curricula: z.array(Curriculum).default([]),
  experienceYears: z.number().int().min(0).max(60),
  hasDegree: z.boolean(),
  tscNumber: TscNumber.optional(),
  tscVerified: z.boolean().default(false),
  openToOpportunities: z.boolean().default(true),
  /** Off by default: an app that makes noise unasked gets muted entirely. */
  notificationSound: z.boolean().default(false),
  skills: z.array(z.string().max(48)).max(20).default([]),
});
export type TeacherProfile = z.infer<typeof TeacherProfile>;

// --- School & jobs -------------------------------------------------------

export const School = z.object({
  id: Uuid,
  name: z.string().min(2).max(160),
  slug: Slug,
  county: County,
  schoolType: SchoolType,
  curricula: z.array(Curriculum).min(1),
  verification: VerificationStatus.default('unverified'),
  teacherCount: z.number().int().nonnegative().optional(),
});
export type School = z.infer<typeof School>;

/**
 * One stated requirement on a job. `weight` is its share of the match score;
 * `mustHave` marks a hard gate - failing it caps the score no matter what else
 * the teacher brings (see `packages/core` scoring rules).
 */
export const JobRequirement = z.object({
  kind: RequirementKind,
  /** Interpretation depends on `kind`: a subject slug, a county, a year count. */
  value: z.string().min(1),
  label: z.string().min(1).max(120),
  weight: z.number().positive().max(10).default(1),
  mustHave: z.boolean().default(false),
});
export type JobRequirement = z.infer<typeof JobRequirement>;

export const Job = z.object({
  id: Uuid,
  /**
   * Null for a listing posted by an individual. Since migration 0008 a job
   * need not belong to a school; `posterKind` on JobWithSchool says which.
   */
  schoolId: Uuid.nullable(),
  title: z.string().min(3).max(160),
  subjects: z.array(Slug).min(1),
  jobType: JobType,
  county: County,
  salary: SalaryBand.optional(),
  /** What the salary figure is per. Monthly for a post, hourly for tuition. */
  ratePeriod: RatePeriod.default('month'),
  requirements: z.array(JobRequirement).default([]),
  postedAt: z.coerce.date(),
  closesAt: z.coerce.date().optional(),
  /**
   * Employment, or a private request from a parent. The three fields below are
   * required for a request and meaningless for a post — the database enforces
   * that pairing, so anything that parses is already coherent.
   */
  engagement: EngagementKind.default('employment'),
  /**
   * The three ways teaching can happen, independent because the common case
   * is a mixture: "online or I come to you, but I cannot host". A single mode
   * could not say that.
   */
  meetsOnline: z.boolean().default(false),
  meetsAtStudent: z.boolean().default(false),
  meetsAtTeacher: z.boolean().default(false),
  level: TeachingLevel.optional(),
  posterRole: PosterRole.optional(),
  preferredGender: GenderPreference.optional(),
  prefersLocality: z.string().min(2).max(80).optional(),
  /** Copied onto the listing so it can name its author without opening the profile. */
  postedByName: z.string().min(1).max(120).optional(),
  /**
   * A ward or estate, never a street address. There is no address anywhere in
   * this schema on purpose: where exactly is what the parent tells the teacher
   * in the thread, once both have agreed.
   */
  area: z.string().min(2).max(80).optional(),
  learnerLevel: z.string().min(1).max(60).optional(),
  sessionsPerWeek: z.number().int().min(1).max(14).optional(),
});
export type Job = z.infer<typeof Job>;

/** A private request from a parent rather than a post at an institution. */
export const isPrivateRequest = (job: Pick<Job, 'engagement'>): boolean =>
  job.engagement !== 'employment';

// --- Applications --------------------------------------------------------

export const Application = z.object({
  id: Uuid,
  jobId: Uuid,
  teacherId: Uuid,
  stage: ApplicationStage,
  source: ApplicationSource,
  matchScore: z.number().int().min(0).max(100),
  createdAt: z.coerce.date(),
});
export type Application = z.infer<typeof Application>;

// --- Auto-Apply ----------------------------------------------------------

/**
 * A teacher's standing instruction to apply on their behalf. Everything here is
 * a constraint the matcher must satisfy BEFORE sending - there is no fallback
 * to "apply anyway", because an unwanted application cannot be recalled.
 */
export const AutoApplyRule = z.object({
  teacherId: Uuid,
  enabled: z.boolean().default(false),
  subjects: z.array(Slug).min(1),
  counties: z.array(County).min(1),
  minSalary: Kes.optional(),
  minMatchScore: z.number().int().min(50).max(100).default(85),
  jobTypes: z.array(JobType).default([]),
  excludedSchoolIds: z.array(Uuid).default([]),
  dailyLimit: z.number().int().min(1).max(20).default(5),
  weeklyLimit: z.number().int().min(1).max(100).default(20),
  requireReviewBeforeSending: z.boolean().default(false),
});
export type AutoApplyRule = z.infer<typeof AutoApplyRule>;

// --- Reviews & red flags -------------------------------------------------

export const CategoryRating = z.object({
  category: ReviewCategory,
  score: z.number().int().min(1).max(5),
});
export type CategoryRating = z.infer<typeof CategoryRating>;

/**
 * A red flag always carries evidence. `reason` is required by the schema, not
 * just by the UI, so no code path can persist a bare accusation.
 */
export const RedFlag = z.object({
  kind: RedFlagKind,
  reason: z.string().min(40).max(1000),
  occurredOn: z.coerce.date().optional(),
});
export type RedFlag = z.infer<typeof RedFlag>;

export const SchoolReview = z.object({
  id: Uuid,
  schoolId: Uuid,
  /** Never exposed to readers; used to enforce one review per person per school. */
  authorId: Uuid,
  employmentVerified: z.boolean(),
  ratings: z.array(CategoryRating).min(1),
  body: z.string().min(40).max(4000),
  redFlags: z.array(RedFlag).max(4).default([]),
  moderation: ModerationStatus.default('pending'),
  createdAt: z.coerce.date(),
});
export type SchoolReview = z.infer<typeof SchoolReview>;
