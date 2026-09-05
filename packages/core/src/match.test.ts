import { describe, expect, it } from 'vitest';
import { MUST_HAVE_FAIL_CAP, matchScore } from './match.js';
import { job, req, teacher } from './fixtures.js';

describe('matchScore', () => {
  it('scores a perfect fit at 100', () => {
    const result = matchScore(job({
      requirements: [
        req({ kind: 'subject', value: 'mathematics', label: 'Mathematics' }),
        req({ kind: 'qualification', value: 'degree', label: "Bachelor's degree" }),
        req({ kind: 'experience_years', value: '3', label: '3+ years experience' }),
        req({ kind: 'tsc_registration', value: 'required', label: 'TSC registration' }),
      ],
    }), teacher());

    expect(result.score).toBe(100);
    expect(result.blocked).toBe(false);
    expect(result.metCount).toBe(4);
  });

  it('gives half credit for a near miss on experience', () => {
    const result = matchScore(job({
      requirements: [req({ kind: 'experience_years', value: '6', label: '6+ years' })],
    }), teacher({ experienceYears: 5 }));

    expect(result.requirements[0]?.status).toBe('partial');
    expect(result.score).toBe(50);
  });

  it('treats an unverified TSC number as partial, not met', () => {
    const result = matchScore(job({
      requirements: [req({ kind: 'tsc_registration', value: 'required', label: 'TSC registration' })],
    }), teacher({ tscVerified: false }));

    expect(result.requirements[0]?.status).toBe('partial');
  });

  it('weights requirements rather than counting them', () => {
    // Subject is worth 4x the curriculum line, so missing the light one should
    // cost far less than missing the heavy one.
    const missingCurriculum = matchScore(job({
      requirements: [
        req({ kind: 'subject', value: 'mathematics', label: 'Mathematics', weight: 4 }),
        req({ kind: 'curriculum', value: 'igcse', label: 'IGCSE experience', weight: 1 }),
      ],
    }), teacher());

    expect(missingCurriculum.score).toBe(80);
  });

  it('caps the score when a must-have is unmet, however strong the rest is', () => {
    const result = matchScore(job({
      requirements: [
        req({ kind: 'subject', value: 'mathematics', label: 'Mathematics', weight: 9 }),
        req({ kind: 'tsc_registration', value: 'required', label: 'TSC registration', mustHave: true }),
      ],
    }), teacher({ tscNumber: undefined, tscVerified: false }));

    expect(result.blocked).toBe(true);
    expect(result.score).toBeLessThanOrEqual(MUST_HAVE_FAIL_CAP);
  });

  it('falls back to subject and location when a job lists no requirements', () => {
    const result = matchScore(job({ requirements: [] }), teacher());
    expect(result.score).toBe(100);

    const elsewhere = matchScore(job({ requirements: [], county: 'mombasa' }), teacher());
    expect(elsewhere.score).toBe(50);
  });

  it('is insensitive to slug casing and stray whitespace', () => {
    const result = matchScore(job({
      requirements: [req({ kind: 'subject', value: ' Mathematics ', label: 'Mathematics' })],
    }), teacher({ subjects: ['MATHEMATICS'] }));

    expect(result.score).toBe(100);
  });
});
