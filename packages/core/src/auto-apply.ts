import type { AutoApplyRule, Job } from '@mwalimu/types';
import type { MatchResult } from './match.js';

/**
 * Auto-Apply decisioning.
 *
 * An application cannot be recalled once a school has seen it, so this function
 * is deliberately biased toward NOT sending: every rule is a gate, and the
 * default on any doubt is to skip with a reason the teacher can read in the
 * activity log.
 */

export const SkipReason = {
  Disabled: 'disabled',
  AlreadyApplied: 'already_applied',
  ExcludedSchool: 'excluded_school',
  SubjectMismatch: 'subject_mismatch',
  CountyMismatch: 'county_mismatch',
  JobTypeMismatch: 'job_type_mismatch',
  BelowMinSalary: 'below_min_salary',
  BelowMinMatch: 'below_min_match',
  MustHaveUnmet: 'must_have_unmet',
  DailyLimitReached: 'daily_limit_reached',
  WeeklyLimitReached: 'weekly_limit_reached',
  JobClosed: 'job_closed',
} as const;
export type SkipReason = (typeof SkipReason)[keyof typeof SkipReason];

/** Human-readable text for the Auto-Apply activity log. */
export const SKIP_REASON_TEXT: Readonly<Record<SkipReason, string>> = {
  disabled: 'Auto-Apply is switched off',
  already_applied: 'You have already applied to this role',
  excluded_school: 'School is on your excluded list',
  subject_mismatch: 'Subject is not in your Auto-Apply rules',
  county_mismatch: 'Location is not in your Auto-Apply rules',
  job_type_mismatch: 'Job type is not in your Auto-Apply rules',
  below_min_salary: 'Salary is below your minimum',
  below_min_match: 'Match score is below your threshold',
  must_have_unmet: 'You do not meet a required qualification',
  daily_limit_reached: 'Daily application limit reached',
  weekly_limit_reached: 'Weekly application limit reached',
  job_closed: 'The role had already closed',
};

export type AutoApplyDecision =
  | { readonly decision: 'apply' }
  /** Rules pass, but the teacher asked to review each one before it is sent. */
  | { readonly decision: 'hold_for_review' }
  | { readonly decision: 'skip'; readonly reason: SkipReason };

export interface AutoApplyContext {
  /** Applications already sent today, in the teacher's local day. */
  readonly sentToday: number;
  readonly sentThisWeek: number;
  readonly alreadyApplied: boolean;
  /** Injected rather than read from the clock, so this stays pure and testable. */
  readonly now: Date;
}

const skip = (reason: SkipReason): AutoApplyDecision => ({ decision: 'skip', reason });

/**
 * Decide whether to auto-apply. Gates run cheapest-and-most-decisive first, so
 * the logged reason is the most useful one rather than an incidental later
 * failure.
 */
export function decideAutoApply(
  rule: AutoApplyRule,
  job: Job,
  match: MatchResult,
  ctx: AutoApplyContext,
): AutoApplyDecision {
  if (!rule.enabled) return skip(SkipReason.Disabled);
  if (ctx.alreadyApplied) return skip(SkipReason.AlreadyApplied);
  if (job.closesAt !== undefined && job.closesAt.getTime() <= ctx.now.getTime()) {
    return skip(SkipReason.JobClosed);
  }
  if (rule.excludedSchoolIds.includes(job.schoolId)) return skip(SkipReason.ExcludedSchool);

  const subjectHit = job.subjects.some((s) => rule.subjects.includes(s));
  if (!subjectHit) return skip(SkipReason.SubjectMismatch);
  if (!rule.counties.includes(job.county)) return skip(SkipReason.CountyMismatch);

  // An empty jobTypes list means "any type" - an explicit list is a filter.
  if (rule.jobTypes.length > 0 && !rule.jobTypes.includes(job.jobType)) {
    return skip(SkipReason.JobTypeMismatch);
  }

  if (rule.minSalary !== undefined) {
    // A job that advertises no salary cannot clear a salary floor. Treating a
    // missing band as "probably fine" is how teachers get auto-applied into
    // roles paying less than they said they would accept.
    if (job.salary === undefined) return skip(SkipReason.BelowMinSalary);
    // Compare against the TOP of the band: if even the ceiling is under the
    // teacher's floor, the role cannot pay what they asked for.
    const ceiling = job.salary.max ?? job.salary.min;
    if (ceiling < rule.minSalary) return skip(SkipReason.BelowMinSalary);
  }

  if (match.blocked) return skip(SkipReason.MustHaveUnmet);
  if (match.score < rule.minMatchScore) return skip(SkipReason.BelowMinMatch);

  if (ctx.sentToday >= rule.dailyLimit) return skip(SkipReason.DailyLimitReached);
  if (ctx.sentThisWeek >= rule.weeklyLimit) return skip(SkipReason.WeeklyLimitReached);

  return rule.requireReviewBeforeSending ? { decision: 'hold_for_review' } : { decision: 'apply' };
}
