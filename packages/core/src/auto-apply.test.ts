import { describe, expect, it } from 'vitest';
import { decideAutoApply, SkipReason } from './auto-apply';
import { matchScore } from './match';
import { job, req, rule, teacher } from './fixtures';

const NOW = new Date('2026-09-05T09:00:00Z');
const ctx = (over: Partial<Parameters<typeof decideAutoApply>[3]> = {}) => ({
  sentToday: 0, sentThisWeek: 0, alreadyApplied: false, now: NOW, ...over,
});

/** A strong, unblocked match — so each test isolates the gate it is about. */
const strong = matchScore(
  job({ requirements: [req({ kind: 'subject', value: 'mathematics', label: 'Mathematics' })] }),
  teacher(),
);

describe('decideAutoApply', () => {
  it('applies when every rule passes', () => {
    expect(decideAutoApply(rule(), job(), strong, ctx())).toEqual({ decision: 'apply' });
  });

  it('holds instead of sending when the teacher asked to review first', () => {
    const decision = decideAutoApply(rule({ requireReviewBeforeSending: true }), job(), strong, ctx());
    expect(decision).toEqual({ decision: 'hold_for_review' });
  });

  it('never applies twice to the same role', () => {
    const decision = decideAutoApply(rule(), job(), strong, ctx({ alreadyApplied: true }));
    expect(decision).toEqual({ decision: 'skip', reason: SkipReason.AlreadyApplied });
  });

  it('refuses a job with no advertised salary when a floor is set', () => {
    // The dangerous default would be to treat "unknown" as acceptable.
    const decision = decideAutoApply(
      rule({ minSalary: 40_000 }), job({ salary: undefined }), strong, ctx(),
    );
    expect(decision).toEqual({ decision: 'skip', reason: SkipReason.BelowMinSalary });
  });

  it('accepts a band whose ceiling clears the floor', () => {
    const decision = decideAutoApply(
      rule({ minSalary: 50_000 }), job({ salary: { min: 45_000, max: 60_000 } }), strong, ctx(),
    );
    expect(decision).toEqual({ decision: 'apply' });
  });

  it('rejects a band that cannot reach the floor at all', () => {
    const decision = decideAutoApply(
      rule({ minSalary: 70_000 }), job({ salary: { min: 45_000, max: 60_000 } }), strong, ctx(),
    );
    expect(decision).toEqual({ decision: 'skip', reason: SkipReason.BelowMinSalary });
  });

  it('will not apply past an unmet must-have even on a high threshold match', () => {
    const blocked = matchScore(job({
      requirements: [
        req({ kind: 'subject', value: 'mathematics', label: 'Mathematics', weight: 9 }),
        req({ kind: 'qualification', value: 'degree', label: 'Degree', mustHave: true }),
      ],
    }), teacher({ hasDegree: false }));

    const decision = decideAutoApply(rule({ minMatchScore: 50 }), job(), blocked, ctx());
    expect(decision).toEqual({ decision: 'skip', reason: SkipReason.MustHaveUnmet });
  });

  it('stops at the daily limit', () => {
    const decision = decideAutoApply(rule({ dailyLimit: 3 }), job(), strong, ctx({ sentToday: 3 }));
    expect(decision).toEqual({ decision: 'skip', reason: SkipReason.DailyLimitReached });
  });

  it('skips a role that has already closed', () => {
    const decision = decideAutoApply(
      rule(), job({ closesAt: new Date('2026-09-04T00:00:00Z') }), strong, ctx(),
    );
    expect(decision).toEqual({ decision: 'skip', reason: SkipReason.JobClosed });
  });

  it('reports the most decisive reason when several gates fail', () => {
    const decision = decideAutoApply(
      rule({ enabled: false, minSalary: 999_999 }), job(), strong, ctx({ sentToday: 99 }),
    );
    expect(decision).toEqual({ decision: 'skip', reason: SkipReason.Disabled });
  });
});

describe('decideAutoApply — listings with no school', () => {
  it('never auto-applies to a listing posted by an individual', () => {
    // Auto-Apply sends documents without the teacher reading the listing
    // first. A rule that matches perfectly must still not do that to an
    // unverified poster; they can apply by hand after looking at it.
    const independent = job({ schoolId: null });
    expect(decideAutoApply(rule(), independent, strong, ctx()))
      .toEqual({ decision: 'skip', reason: SkipReason.UnverifiedPoster });
  });

  it('still applies to the same job once it belongs to a school', () => {
    expect(decideAutoApply(rule(), job(), strong, ctx())).toEqual({ decision: 'apply' });
  });
});
