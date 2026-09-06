import { describe, expect, it } from 'vitest';
import { REVIEW_LIMITS, validateReviewDraft, type ReviewDraftInput } from './review-draft';

const long = (n: number) => 'x'.repeat(n);

const draft = (over: Partial<ReviewDraftInput> = {}): ReviewDraftInput => ({
  body: long(REVIEW_LIMITS.bodyMin),
  ratings: [{ category: 'management', score: 4 }],
  redFlags: [],
  ...over,
});

describe('validateReviewDraft', () => {
  it('accepts the smallest legal review', () => {
    expect(validateReviewDraft(draft())).toEqual([]);
  });

  it('counts exactly how many characters are missing', () => {
    const problems = validateReviewDraft(draft({ body: long(REVIEW_LIMITS.bodyMin - 7) }));
    expect(problems).toContainEqual({ field: 'body', message: 'Your review needs 7 more characters.' });
  });

  it('says "character" rather than "characters" when one is missing', () => {
    const problems = validateReviewDraft(draft({ body: long(REVIEW_LIMITS.bodyMin - 1) }));
    expect(problems).toContainEqual({ field: 'body', message: 'Your review needs 1 more character.' });
  });

  it('does not count leading and trailing space toward the minimum', () => {
    // The database trims nothing, but a body of 40 spaces is not a review.
    const problems = validateReviewDraft(draft({ body: `  ${long(REVIEW_LIMITS.bodyMin - 5)}  ` }));
    expect(problems.some((p) => p.field === 'body')).toBe(true);
  });

  it('requires at least one rating', () => {
    const problems = validateReviewDraft(draft({ ratings: [] }));
    expect(problems).toContainEqual({ field: 'ratings', message: 'Rate at least one category.' });
  });

  it('rejects a category rated twice — it would break the primary key', () => {
    const problems = validateReviewDraft(draft({
      ratings: [{ category: 'management', score: 4 }, { category: 'management', score: 2 }],
    }));
    expect(problems).toContainEqual({ field: 'ratings', message: 'Each category can only be rated once.' });
  });

  it('rejects a score outside 1-5', () => {
    expect(validateReviewDraft(draft({ ratings: [{ category: 'workload', score: 0 }] }))
      .some((p) => p.field === 'ratings')).toBe(true);
    expect(validateReviewDraft(draft({ ratings: [{ category: 'workload', score: 6 }] }))
      .some((p) => p.field === 'ratings')).toBe(true);
  });

  it('demands evidence for a red flag', () => {
    const problems = validateReviewDraft(draft({
      redFlags: [{ kind: 'salary_delays', reason: 'they were late' }],
    }));
    expect(problems.some((p) => p.field === 'redFlags')).toBe(true);
  });

  it('accepts a red flag once the evidence is long enough', () => {
    const problems = validateReviewDraft(draft({
      redFlags: [{ kind: 'salary_delays', reason: long(REVIEW_LIMITS.reasonMin) }],
    }));
    expect(problems).toEqual([]);
  });

  it('caps red flags at four', () => {
    const problems = validateReviewDraft(draft({
      redFlags: (['salary_delays', 'excessive_workload', 'poor_management', 'contract_issues', 'harassment'] as const)
        .map((kind) => ({ kind, reason: long(REVIEW_LIMITS.reasonMin) })),
    }));
    expect(problems).toContainEqual({ field: 'redFlags', message: 'At most 4 red flags per review.' });
  });

  it('reports every problem at once rather than one at a time', () => {
    const problems = validateReviewDraft({ body: '', ratings: [], redFlags: [] });
    expect(problems.map((p) => p.field).sort()).toEqual(['body', 'ratings']);
  });
});
