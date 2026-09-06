import { describe, expect, it } from 'vitest';
import { aggregateSchoolRatings, reviewAverage, summariseRedFlags, type RatedReview } from './reviews';

const NOW = new Date('2026-09-06T12:00:00Z');

const review = (over: Partial<RatedReview> = {}): RatedReview => ({
  id: 'r1',
  createdAt: new Date('2026-08-01T00:00:00Z'),
  ratings: [],
  redFlags: [],
  ...over,
});

describe('aggregateSchoolRatings', () => {
  it('returns null overall when nothing has been rated', () => {
    const result = aggregateSchoolRatings([]);
    expect(result.overall).toBeNull();
    expect(result.reviewCount).toBe(0);
  });

  it('weights each review equally, not each rating', () => {
    // A thorough reviewer scoring four categories at 1 must not outweigh a
    // brief one scoring a single category at 5. Per-review means give 3.0;
    // pooling every rating would give 1.8 — the loudest voice, not the
    // commonest experience.
    const thorough = review({
      id: 'thorough',
      ratings: [
        { category: 'management', score: 1 },
        { category: 'workload', score: 1 },
        { category: 'housing', score: 1 },
        { category: 'resources', score: 1 },
      ],
    });
    const brief = review({ id: 'brief', ratings: [{ category: 'management', score: 5 }] });

    expect(aggregateSchoolRatings([thorough, brief]).overall).toBe(3);
  });

  it('averages a category only over reviews that rated it', () => {
    const a = review({ id: 'a', ratings: [{ category: 'pay_reliability', score: 2 }] });
    const b = review({ id: 'b', ratings: [{ category: 'workload', score: 4 }] });

    const { byCategory } = aggregateSchoolRatings([a, b]);
    const pay = byCategory.find((c) => c.category === 'pay_reliability');

    // A blank is absent, never counted as zero.
    expect(pay).toEqual({ category: 'pay_reliability', average: 2, count: 1 });
  });

  it('orders categories worst first', () => {
    const r = review({
      ratings: [
        { category: 'management', score: 5 },
        { category: 'pay_reliability', score: 2 },
        { category: 'workload', score: 3 },
      ],
    });
    expect(aggregateSchoolRatings([r]).byCategory.map((c) => c.category))
      .toEqual(['pay_reliability', 'workload', 'management']);
  });

  it('rounds to one decimal', () => {
    const r1 = review({ id: '1', ratings: [{ category: 'management', score: 4 }] });
    const r2 = review({ id: '2', ratings: [{ category: 'management', score: 5 }] });
    const r3 = review({ id: '3', ratings: [{ category: 'management', score: 5 }] });
    expect(aggregateSchoolRatings([r1, r2, r3]).overall).toBe(4.7);
  });

  it('ignores a review with no ratings when averaging', () => {
    const rated = review({ id: 'rated', ratings: [{ category: 'management', score: 4 }] });
    const unrated = review({ id: 'unrated' });

    const result = aggregateSchoolRatings([rated, unrated]);
    expect(result.overall).toBe(4);
    expect(result.reviewCount).toBe(2); // still counted as a review
  });
});

describe('reviewAverage', () => {
  it('is null for an unrated review', () => {
    expect(reviewAverage(review())).toBeNull();
  });
});

describe('summariseRedFlags', () => {
  it('counts by kind, commonest first', () => {
    const reviews = [
      review({ id: '1', redFlags: [{ kind: 'salary_delays' }, { kind: 'excessive_workload' }] }),
      review({ id: '2', redFlags: [{ kind: 'salary_delays' }] }),
      review({ id: '3', redFlags: [{ kind: 'salary_delays' }] }),
    ];
    expect(summariseRedFlags(reviews, NOW)).toEqual([
      { kind: 'salary_delays', count: 3 },
      { kind: 'excessive_workload', count: 1 },
    ]);
  });

  it('ages out flags older than the window', () => {
    // A school that fixed its payroll two years ago should not carry it forever.
    const old = review({ createdAt: new Date('2024-01-01T00:00:00Z'), redFlags: [{ kind: 'salary_delays' }] });
    expect(summariseRedFlags([old], NOW)).toEqual([]);
  });

  it('dates a flag by when the incident happened, not when it was filed', () => {
    // Filed recently, but about something two years old.
    const r = review({
      createdAt: new Date('2026-09-01T00:00:00Z'),
      redFlags: [{ kind: 'harassment', occurredOn: new Date('2024-02-01T00:00:00Z') }],
    });
    expect(summariseRedFlags([r], NOW)).toEqual([]);
  });

  it('breaks a count tie deterministically', () => {
    const r = review({ redFlags: [{ kind: 'unclear_hours' }, { kind: 'contract_issues' }] });
    expect(summariseRedFlags([r], NOW).map((f) => f.kind)).toEqual(['contract_issues', 'unclear_hours']);
  });
});
