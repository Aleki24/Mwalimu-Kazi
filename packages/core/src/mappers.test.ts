import { describe, expect, it } from 'vitest';
import { parseJob, parseJobsWithSchools, type JobRowWithSchool } from './mappers';
import type { Tables } from '@mwalimu/types';

const row = (over: Partial<Tables<'jobs'>> = {}): Tables<'jobs'> => ({
  id: '22222222-2222-4222-8222-222222222222',
  school_id: '33333333-3333-4333-8333-333333333333',
  title: 'Mathematics Teacher',
  subjects: ['mathematics'],
  job_type: 'full_time',
  county: 'nairobi',
  salary_min: 45_000,
  salary_max: 60_000,
  requirements: [],
  published: true,
  posted_at: '2026-09-01T08:00:00Z',
  closes_at: null,
  created_at: '2026-09-01T08:00:00Z',
  posted_by: null,
  poster_kind: 'school',
  ...over,
});

const joined = (over: Partial<JobRowWithSchool> = {}): JobRowWithSchool => ({
  ...row(),
  schools: { name: 'Greenfield Academy', school_type: 'private', curricula: ['cbc'] },
  ...over,
});

describe('parseJob', () => {
  it('maps a well-formed row', () => {
    const result = parseJob(row());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.salary).toEqual({ min: 45_000, max: 60_000 });
    expect(result.value.postedAt).toBeInstanceOf(Date);
    expect(result.value.closesAt).toBeUndefined();
  });

  it('leaves salary undefined when the school advertised none', () => {
    const result = parseJob(row({ salary_min: null, salary_max: null }));
    expect(result.ok && result.value.salary).toBeUndefined();
  });

  it('treats a lone figure as a floor, not a band from zero', () => {
    // A band of {min: 0, max: 40000} would clear any Auto-Apply salary rule.
    const result = parseJob(row({ salary_min: null, salary_max: 40_000 }));
    expect(result.ok && result.value.salary).toEqual({ min: 40_000 });
  });

  it('REJECTS the row when requirements are malformed', () => {
    // Dropping the bad entries instead would raise the match score by removing
    // requirements the teacher does not meet.
    const result = parseJob(row({
      requirements: [{ kind: 'not_a_kind', value: 'x', label: 'X', weight: 1, mustHave: true }],
    }));
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toContain('malformed requirements');
  });

  it('rejects a row whose requirements are not even an array', () => {
    expect(parseJob(row({ requirements: { kind: 'subject' } })).ok).toBe(false);
  });
});

describe('parseJobsWithSchools', () => {
  it('reports skipped rows rather than shrinking the list silently', () => {
    const bad = joined({
      id: '44444444-4444-4444-8444-444444444444',
      requirements: [{ nope: true }],
    });
    const { jobs, skipped } = parseJobsWithSchools([joined(), bad]);

    expect(jobs).toHaveLength(1);
    expect(skipped).toHaveLength(1);
    expect(skipped[0]).toContain('malformed requirements');
  });

  it('skips a job whose school did not come back from the join', () => {
    const { jobs, skipped } = parseJobsWithSchools([joined({ schools: null })]);
    expect(jobs).toHaveLength(0);
    expect(skipped[0]).toContain('missing school');
  });

  it('carries the school through for filtering', () => {
    const { jobs } = parseJobsWithSchools([joined()]);
    expect(jobs[0]?.schoolName).toBe('Greenfield Academy');
    expect(jobs[0]?.schoolCurricula).toEqual(['cbc']);
  });
});
