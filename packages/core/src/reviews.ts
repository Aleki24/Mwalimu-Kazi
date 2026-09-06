import type { RedFlagKind, ReviewCategory } from '@mwalimu/types';

/**
 * Turning individual reviews into the numbers a school profile shows.
 *
 * Pure and tested for the same reason as `matchScore`: a teacher deciding
 * whether to accept a post and a school reading its own page must see the same
 * figures, and a rating that shifts depending on which screen computed it is
 * worse than no rating at all.
 */

export interface RatedReview {
  readonly id: string;
  readonly createdAt: Date;
  readonly ratings: ReadonlyArray<{ readonly category: ReviewCategory; readonly score: number }>;
  readonly redFlags: ReadonlyArray<{ readonly kind: RedFlagKind; readonly occurredOn?: Date }>;
}

export interface CategoryAverage {
  readonly category: ReviewCategory;
  readonly average: number;
  /** How many reviews rated this category; the rest left it blank. */
  readonly count: number;
}

export interface SchoolRatings {
  readonly overall: number | null;
  readonly reviewCount: number;
  readonly byCategory: readonly CategoryAverage[];
}

const round1 = (n: number): number => Math.round(n * 10) / 10;

const mean = (values: readonly number[]): number =>
  values.reduce((sum, v) => sum + v, 0) / values.length;

/** The mean of one review's own category scores. */
export function reviewAverage(review: RatedReview): number | null {
  if (review.ratings.length === 0) return null;
  return mean(review.ratings.map((r) => r.score));
}

/**
 * Aggregate a school's reviews.
 *
 * `overall` is the mean of each REVIEW's average, not the mean of every rating.
 * Otherwise a thorough reviewer who scored all ten categories would count more
 * than three times as heavily as one who scored three — the loudest voice, not
 * the commonest experience.
 *
 * `byCategory` averages only over reviews that actually rated that category, so
 * a blank is absent rather than counted as zero.
 */
export function aggregateSchoolRatings(reviews: readonly RatedReview[]): SchoolRatings {
  const perReview = reviews.map(reviewAverage).filter((v): v is number => v !== null);

  const buckets = new Map<ReviewCategory, number[]>();
  for (const review of reviews) {
    for (const rating of review.ratings) {
      const existing = buckets.get(rating.category);
      if (existing === undefined) buckets.set(rating.category, [rating.score]);
      else existing.push(rating.score);
    }
  }

  const byCategory = [...buckets.entries()]
    .map(([category, scores]) => ({ category, average: round1(mean(scores)), count: scores.length }))
    // Worst first: the reason a teacher opens this screen is to find the problems.
    .sort((a, b) => a.average - b.average);

  return {
    overall: perReview.length === 0 ? null : round1(mean(perReview)),
    reviewCount: reviews.length,
    byCategory,
  };
}

export interface RedFlagCount {
  readonly kind: RedFlagKind;
  readonly count: number;
}

const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Red flags raised within `months`, commonest first.
 *
 * Old flags age out on purpose. A school that fixed its payroll two years ago
 * should not carry it forever, and a permanent record would make the system
 * punitive rather than informative. A flag is dated by when the incident
 * happened where the reviewer said so, otherwise by when the review was filed.
 */
export function summariseRedFlags(
  reviews: readonly RatedReview[],
  now: Date,
  months = 12,
): readonly RedFlagCount[] {
  const cutoff = now.getTime() - months * MONTH_MS;
  const counts = new Map<RedFlagKind, number>();

  for (const review of reviews) {
    for (const flag of review.redFlags) {
      const when = (flag.occurredOn ?? review.createdAt).getTime();
      if (when < cutoff) continue;
      counts.set(flag.kind, (counts.get(flag.kind) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([kind, count]) => ({ kind, count }))
    .sort((a, b) => b.count - a.count || a.kind.localeCompare(b.kind));
}

/** Human wording for each red flag, shared by the school profile and the composer. */
export const RED_FLAG_LABEL: Readonly<Record<RedFlagKind, string>> = {
  salary_delays: 'Salary delays',
  excessive_workload: 'Excessive workload',
  poor_management: 'Poor management',
  contract_issues: 'Contract issues',
  harassment: 'Harassment',
  unclear_hours: 'Unclear working hours',
  poor_communication: 'Poor communication',
  unsafe_conditions: 'Unsafe conditions',
};

export const REVIEW_CATEGORY_LABEL: Readonly<Record<ReviewCategory, string>> = {
  management: 'Management',
  pay_reliability: 'Pay reliability',
  workload: 'Workload',
  working_hours: 'Working hours',
  teacher_treatment: 'Teacher treatment',
  professional_growth: 'Professional growth',
  housing: 'Housing',
  student_behaviour: 'Student behaviour',
  resources: 'Resources',
  communication: 'Communication',
};
