import type { RedFlagKind, ReviewCategory } from '@mwalimu/types';

/**
 * The limits, in one place.
 *
 * These are not UI preferences — every one of them is a CHECK constraint in
 * migration 0004. If they drift, a teacher writes a review, taps Submit and
 * gets a raw Postgres error for the first time at the worst possible moment.
 * The character counters, the validator and the database all read from here.
 */
export const REVIEW_LIMITS = {
  bodyMin: 40,
  bodyMax: 4000,
  /** A red flag always carries evidence; 40 characters is the floor for it. */
  reasonMin: 40,
  reasonMax: 1000,
  maxRedFlags: 4,
  minRatings: 1,
  scoreMin: 1,
  scoreMax: 5,
} as const;

export interface DraftRating {
  readonly category: ReviewCategory;
  readonly score: number;
}

export interface DraftRedFlag {
  readonly kind: RedFlagKind;
  readonly reason: string;
}

export interface ReviewDraftInput {
  readonly body: string;
  readonly ratings: readonly DraftRating[];
  readonly redFlags: readonly DraftRedFlag[];
}

export type DraftField = 'ratings' | 'body' | 'redFlags';

export interface DraftProblem {
  readonly field: DraftField;
  readonly message: string;
}

/**
 * Everything wrong with a draft, in the order a writer would fix it. An empty
 * array means the database will accept it.
 *
 * Returns all problems rather than the first, because a submit button that
 * reveals one blocker at a time is how a form becomes a guessing game.
 */
export function validateReviewDraft(draft: ReviewDraftInput): readonly DraftProblem[] {
  const problems: DraftProblem[] = [];
  const body = draft.body.trim();

  if (draft.ratings.length < REVIEW_LIMITS.minRatings) {
    problems.push({ field: 'ratings', message: 'Rate at least one category.' });
  }
  if (draft.ratings.some(
    (r) => !Number.isInteger(r.score)
      || r.score < REVIEW_LIMITS.scoreMin
      || r.score > REVIEW_LIMITS.scoreMax,
  )) {
    problems.push({ field: 'ratings', message: 'Every rating must be a whole number from 1 to 5.' });
  }
  // A category rated twice would violate the (review_id, category) primary key.
  if (new Set(draft.ratings.map((r) => r.category)).size !== draft.ratings.length) {
    problems.push({ field: 'ratings', message: 'Each category can only be rated once.' });
  }

  if (body.length < REVIEW_LIMITS.bodyMin) {
    const short = REVIEW_LIMITS.bodyMin - body.length;
    problems.push({
      field: 'body',
      message: `Your review needs ${short} more character${short === 1 ? '' : 's'}.`,
    });
  }
  if (body.length > REVIEW_LIMITS.bodyMax) {
    problems.push({ field: 'body', message: `Keep it under ${REVIEW_LIMITS.bodyMax} characters.` });
  }

  if (draft.redFlags.length > REVIEW_LIMITS.maxRedFlags) {
    problems.push({
      field: 'redFlags',
      message: `At most ${REVIEW_LIMITS.maxRedFlags} red flags per review.`,
    });
  }
  if (new Set(draft.redFlags.map((f) => f.kind)).size !== draft.redFlags.length) {
    problems.push({ field: 'redFlags', message: 'Each red flag can only be raised once.' });
  }
  for (const flag of draft.redFlags) {
    const reason = flag.reason.trim();
    if (reason.length < REVIEW_LIMITS.reasonMin) {
      const short = REVIEW_LIMITS.reasonMin - reason.length;
      problems.push({
        field: 'redFlags',
        message: `Say what happened — ${short} more character${short === 1 ? '' : 's'}.`,
      });
    } else if (reason.length > REVIEW_LIMITS.reasonMax) {
      problems.push({
        field: 'redFlags',
        message: `Keep each explanation under ${REVIEW_LIMITS.reasonMax} characters.`,
      });
    }
  }

  return problems;
}
