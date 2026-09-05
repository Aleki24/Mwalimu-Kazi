import { z } from 'zod';

/**
 * Domain vocabularies. These are the values the database CHECK constraints and
 * the UI filter chips both derive from - add a value here and in the matching
 * migration, never in one place only.
 */

export const Curriculum = z.enum(['cbc', '8-4-4', 'igcse', 'ib', 'montessori']);
export type Curriculum = z.infer<typeof Curriculum>;

export const JobType = z.enum(['full_time', 'part_time', 'contract', 'locum']);
export type JobType = z.infer<typeof JobType>;

export const SchoolType = z.enum(['private', 'international', 'public']);
export type SchoolType = z.infer<typeof SchoolType>;

/** Kenya's 47 counties are the location primitive; stored as a slug. */
export const County = z.enum([
  'baringo', 'bomet', 'bungoma', 'busia', 'elgeyo-marakwet', 'embu', 'garissa',
  'homa-bay', 'isiolo', 'kajiado', 'kakamega', 'kericho', 'kiambu', 'kilifi',
  'kirinyaga', 'kisii', 'kisumu', 'kitui', 'kwale', 'laikipia', 'lamu',
  'machakos', 'makueni', 'mandera', 'marsabit', 'meru', 'migori', 'mombasa',
  'muranga', 'nairobi', 'nakuru', 'nandi', 'narok', 'nyamira', 'nyandarua',
  'nyeri', 'samburu', 'siaya', 'taita-taveta', 'tana-river', 'tharaka-nithi',
  'trans-nzoia', 'turkana', 'uasin-gishu', 'vihiga', 'wajir', 'west-pokot',
]);
export type County = z.infer<typeof County>;

/** Where an application currently sits. Mirrors the tracker board columns. */
export const ApplicationStage = z.enum([
  'saved', 'applied', 'viewed', 'shortlisted', 'interview', 'offered', 'rejected', 'withdrawn',
]);
export type ApplicationStage = z.infer<typeof ApplicationStage>;

/** How an application was sent - auto-applications must stay distinguishable. */
export const ApplicationSource = z.enum(['manual', 'auto_apply']);
export type ApplicationSource = z.infer<typeof ApplicationSource>;

export const VerificationStatus = z.enum(['unverified', 'pending', 'verified', 'under_review']);
export type VerificationStatus = z.infer<typeof VerificationStatus>;

/**
 * The red-flag taxonomy is CLOSED on purpose. Reviewers pick from this list and
 * must supply evidence; free-text accusations are what makes a review system
 * defamatory rather than useful.
 */
export const RedFlagKind = z.enum([
  'salary_delays',
  'excessive_workload',
  'poor_management',
  'contract_issues',
  'harassment',
  'unclear_hours',
  'poor_communication',
  'unsafe_conditions',
]);
export type RedFlagKind = z.infer<typeof RedFlagKind>;

/** Structured review dimensions - each scored 1-5, never a single blob rating. */
export const ReviewCategory = z.enum([
  'management', 'pay_reliability', 'workload', 'working_hours', 'teacher_treatment',
  'professional_growth', 'housing', 'student_behaviour', 'resources', 'communication',
]);
export type ReviewCategory = z.infer<typeof ReviewCategory>;

export const ModerationStatus = z.enum(['pending', 'approved', 'rejected']);
export type ModerationStatus = z.infer<typeof ModerationStatus>;

/** What a job requirement is about; drives how the matcher compares it. */
export const RequirementKind = z.enum([
  'subject', 'qualification', 'experience_years', 'tsc_registration', 'curriculum', 'county',
]);
export type RequirementKind = z.infer<typeof RequirementKind>;
