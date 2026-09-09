import type { AutoApplyRule, Job, JobRequirement, TeacherProfile } from '@mwalimu/types';

/** Test fixtures. Overrides are shallow-merged so each test states only what it cares about. */

export const teacher = (over: Partial<TeacherProfile> = {}): TeacherProfile => ({
  id: '11111111-1111-4111-8111-111111111111',
  fullName: 'Alex Otieno',
  county: 'nairobi',
  subjects: ['mathematics', 'computer-studies'],
  curricula: ['cbc'],
  experienceYears: 5,
  hasDegree: true,
  tscNumber: '123456',
  tscVerified: true,
  openToOpportunities: true,
  notificationSound: false,
  skills: [],
  ...over,
});

export const req = (over: Partial<JobRequirement> & Pick<JobRequirement, 'kind' | 'value' | 'label'>): JobRequirement => ({
  weight: 1,
  mustHave: false,
  ...over,
});

export const job = (over: Partial<Job> = {}): Job => ({
  id: '22222222-2222-4222-8222-222222222222',
  schoolId: '33333333-3333-4333-8333-333333333333',
  title: 'Mathematics Teacher',
  subjects: ['mathematics'],
  jobType: 'full_time',
  ratePeriod: 'month',
  engagement: 'employment',
  county: 'nairobi',
  salary: { min: 45_000, max: 60_000 },
  requirements: [],
  postedAt: new Date('2026-09-01T08:00:00Z'),
  ...over,
});

export const rule = (over: Partial<AutoApplyRule> = {}): AutoApplyRule => ({
  teacherId: '11111111-1111-4111-8111-111111111111',
  enabled: true,
  subjects: ['mathematics'],
  counties: ['nairobi'],
  minMatchScore: 85,
  jobTypes: [],
  excludedSchoolIds: [],
  dailyLimit: 5,
  weeklyLimit: 20,
  requireReviewBeforeSending: false,
  ...over,
});
