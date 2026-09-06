import { describe, expect, it } from 'vitest';
import {
  explainMatch, formatClosing, formatPostedAge, formatSalary, formatSalaryFull, matchBand,
} from './format.js';
import { matchScore } from './match.js';
import { job, req, teacher } from './fixtures.js';

const NOW = new Date('2026-09-05T12:00:00Z');

describe('formatSalary', () => {
  it('renders a band compactly', () => {
    expect(formatSalary({ min: 45_000, max: 60_000 })).toBe('KSh 45–60k');
  });

  it('renders an open-ended floor', () => {
    expect(formatSalary({ min: 40_000 })).toBe('KSh 40k+');
  });

  it('never invents a figure that was not advertised', () => {
    expect(formatSalary(undefined)).toBe('Salary not stated');
    expect(formatSalaryFull(undefined)).toBe('Salary not stated');
  });

  it('spells the band out in full on a detail screen', () => {
    expect(formatSalaryFull({ min: 45_000, max: 60_000 })).toBe('KSh 45,000–60,000 per month');
  });
});

describe('formatPostedAge', () => {
  it('scales from minutes to days', () => {
    expect(formatPostedAge(new Date('2026-09-05T11:57:00Z'), NOW)).toBe('3 min ago');
    expect(formatPostedAge(new Date('2026-09-05T07:00:00Z'), NOW)).toBe('5h ago');
    expect(formatPostedAge(new Date('2026-09-03T12:00:00Z'), NOW)).toBe('2d ago');
  });

  it('does not render a negative age from clock skew', () => {
    expect(formatPostedAge(new Date('2026-09-05T12:05:00Z'), NOW)).toBe('just now');
  });
});

describe('formatClosing', () => {
  it('escalates as the deadline nears', () => {
    expect(formatClosing(new Date('2026-09-05T18:00:00Z'), NOW)).toBe('Closes today');
    expect(formatClosing(new Date('2026-09-06T18:00:00Z'), NOW)).toBe('Closes tomorrow');
    expect(formatClosing(new Date('2026-09-11T12:00:00Z'), NOW)).toBe('Closes in 6 days');
    expect(formatClosing(new Date('2026-09-01T12:00:00Z'), NOW)).toBe('Closed');
  });

  it('says nothing when there is no deadline', () => {
    expect(formatClosing(undefined, NOW)).toBeNull();
  });
});

describe('matchBand', () => {
  it('bands consistently at the boundaries', () => {
    expect(matchBand(94)).toBe('strong');
    expect(matchBand(90)).toBe('strong');
    expect(matchBand(89)).toBe('good');
    expect(matchBand(60)).toBe('partial');
    expect(matchBand(49)).toBe('weak');
  });
});

describe('explainMatch', () => {
  it('counts the requirements met', () => {
    const match = matchScore(job({
      requirements: [
        req({ kind: 'subject', value: 'mathematics', label: 'Mathematics' }),
        req({ kind: 'curriculum', value: 'igcse', label: 'IGCSE experience' }),
      ],
    }), teacher());

    expect(explainMatch(match)).toBe('You meet 1 of 2 listed requirements.');
  });

  it('names the blocking requirement rather than dressing up a capped score', () => {
    const match = matchScore(job({
      requirements: [req({ kind: 'qualification', value: 'degree', label: 'A degree in Education', mustHave: true })],
    }), teacher({ hasDegree: false }));

    expect(explainMatch(match)).toBe('This role requires a degree in education, which is not on your profile.');
  });
});

describe('formatClosing — calendar boundaries', () => {
  // These are the cases elapsed-hours arithmetic gets wrong.
  it('calls a deadline tomorrow "tomorrow" even when it is over 24h away', () => {
    // 30 hours away, but the next calendar day in Nairobi.
    expect(formatClosing(new Date('2026-09-06T18:00:00Z'), NOW)).toBe('Closes tomorrow');
  });

  it('does not call a deadline "today" just because it is under 24h away', () => {
    // 20 hours away, but it falls tomorrow.
    expect(formatClosing(new Date('2026-09-06T08:00:00Z'), NOW)).toBe('Closes tomorrow');
  });

  it('reads the date in Nairobi, not UTC', () => {
    // 22:30 UTC on the 5th is 01:30 on the 6th in Nairobi (UTC+3).
    const lateUtc = new Date('2026-09-05T22:30:00Z');
    expect(formatClosing(lateUtc, NOW)).toBe('Closes tomorrow');
    expect(formatClosing(lateUtc, NOW, 'UTC')).toBe('Closes today');
  });
});
