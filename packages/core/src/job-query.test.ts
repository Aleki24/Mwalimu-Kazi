import { describe, expect, it } from 'vitest';
import { closingSoon, filterJobs, rankJobs, requiredExperience, requiresTsc, type JobWithSchool } from './job-query';
import { job, req, teacher } from './fixtures';

const NOW = new Date('2026-09-05T09:00:00Z');

const entry = (over: Partial<JobWithSchool> & { job: JobWithSchool['job'] }): JobWithSchool => ({
  schoolName: 'Greenfield Academy',
  schoolSlug: 'greenfield-academy',
  schoolType: 'private',
  schoolCurricula: ['cbc'],
  schoolVerification: 'verified',
  posterKind: 'school',
  ...over,
});

describe('filterJobs — listings with no school', () => {
  // Since 0008 a job can be posted by an individual and belong to no school.
  const independent = entry({
    job: job({}),
    schoolName: 'Independent listing',
    schoolType: null,
    schoolCurricula: [],
    posterKind: 'individual',
  });

  it('keeps an independent listing when no school filter is applied', () => {
    expect(filterJobs([independent], {})).toHaveLength(1);
  });

  it('excludes it from a school-type filter rather than guessing a type', () => {
    expect(filterJobs([independent], { schoolTypes: ['private'] })).toHaveLength(0);
  });

  it('excludes it from a curriculum filter — it advertises none', () => {
    expect(filterJobs([independent], { curricula: ['cbc'] })).toHaveLength(0);
  });
});

describe('filterJobs', () => {
  const maths = entry({ job: job({ id: '1'.repeat(8) + '-1111-4111-8111-111111111111', subjects: ['mathematics'] }) });
  const kiswahili = entry({
    job: job({ id: '4'.repeat(8) + '-4444-4444-8444-444444444444', subjects: ['kiswahili'], county: 'mombasa' }),
    schoolType: 'international',
    schoolCurricula: ['ib'],
  });
  const all = [maths, kiswahili];

  it('treats an omitted filter as no constraint', () => {
    expect(filterJobs(all, {})).toHaveLength(2);
  });

  it('filters by subject, county, school type and curriculum', () => {
    expect(filterJobs(all, { subjects: ['mathematics'] })).toEqual([maths]);
    expect(filterJobs(all, { counties: ['mombasa'] })).toEqual([kiswahili]);
    expect(filterJobs(all, { schoolTypes: ['international'] })).toEqual([kiswahili]);
    expect(filterJobs(all, { curricula: ['cbc'] })).toEqual([maths]);
  });

  it('keeps a job with no advertised salary when a floor is set', () => {
    // Browsing is reversible, so an unpriced listing stays visible and the
    // teacher decides. Auto-Apply takes the opposite stance.
    const unpriced = entry({ job: job({ salary: undefined }) });
    expect(filterJobs([unpriced], { minSalary: 80_000 })).toHaveLength(1);
  });

  it('drops a job whose whole salary band is under the floor', () => {
    const low = entry({ job: job({ salary: { min: 20_000, max: 30_000 } }) });
    expect(filterJobs([low], { minSalary: 40_000 })).toHaveLength(0);
  });

  it('uses experience as a ceiling, so juniors are not shown senior posts', () => {
    const senior = entry({ job: job({ requirements: [req({ kind: 'experience_years', value: '8', label: '8+ years' })] }) });
    expect(filterJobs([senior], { maxExperienceYears: 2 })).toHaveLength(0);
    expect(filterJobs([senior], { maxExperienceYears: 10 })).toHaveLength(1);
  });

  it('searches title, school name and subject', () => {
    expect(filterJobs(all, { query: 'greenfield' })).toHaveLength(2);
    expect(filterJobs(all, { query: 'kiswahili' })).toEqual([kiswahili]);
    expect(filterJobs(all, { query: '' })).toHaveLength(2);
  });

  it('combines filters conjunctively', () => {
    expect(filterJobs(all, { subjects: ['mathematics'], counties: ['mombasa'] })).toHaveLength(0);
  });
});

describe('rankJobs', () => {
  it('puts the stronger match first', () => {
    const strong = entry({ job: job({ id: 'a'.repeat(8) + '-aaaa-4aaa-8aaa-aaaaaaaaaaaa', subjects: ['mathematics'] }) });
    const weak = entry({ job: job({ id: 'b'.repeat(8) + '-bbbb-4bbb-8bbb-bbbbbbbbbbbb', subjects: ['history'], county: 'kisumu' }) });

    const ranked = rankJobs([weak, strong], teacher(), NOW);
    expect(ranked[0]?.job.id).toBe(strong.job.id);
  });

  it('breaks a score tie by which role closes first', () => {
    const soon = entry({ job: job({ id: 'c'.repeat(8) + '-cccc-4ccc-8ccc-cccccccccccc', closesAt: new Date('2026-09-06T00:00:00Z') }) });
    const later = entry({ job: job({ id: 'd'.repeat(8) + '-dddd-4ddd-8ddd-dddddddddddd', closesAt: new Date('2026-10-01T00:00:00Z') }) });

    const ranked = rankJobs([later, soon], teacher(), NOW);
    expect(ranked[0]?.job.id).toBe(soon.job.id);
  });

  it('drops roles that have already closed', () => {
    const closed = entry({ job: job({ closesAt: new Date('2026-09-01T00:00:00Z') }) });
    expect(rankJobs([closed], teacher(), NOW)).toHaveLength(0);
  });
});

describe('closingSoon', () => {
  it('picks up only roles inside the window', () => {
    const today = entry({ job: job({ id: 'e'.repeat(8) + '-eeee-4eee-8eee-eeeeeeeeeeee', closesAt: new Date('2026-09-05T20:00:00Z') }) });
    const nextWeek = entry({ job: job({ id: 'f'.repeat(8) + '-ffff-4fff-8fff-ffffffffffff', closesAt: new Date('2026-09-12T09:00:00Z') }) });
    const openEnded = entry({ job: job() });

    const soon = closingSoon([today, nextWeek, openEnded], NOW);
    expect(soon).toEqual([today]);
  });
});

describe('requirement helpers', () => {
  it('reads the experience bar and TSC requirement off a job', () => {
    const j = job({
      requirements: [
        req({ kind: 'experience_years', value: '3', label: '3+ years' }),
        req({ kind: 'tsc_registration', value: 'required', label: 'TSC' }),
      ],
    });
    expect(requiredExperience(j)).toBe(3);
    expect(requiresTsc(j)).toBe(true);
    expect(requiredExperience(job())).toBeNull();
  });
});
