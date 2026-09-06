import type { TeacherProfile } from '@mwalimu/types';

/**
 * Stand-in profile used until sign-in exists.
 *
 * Match scores are only meaningful relative to a real teacher, so the Jobs
 * screen needs someone to score against. Replace this with the signed-in
 * profile once auth lands — it is the single place the swap happens.
 */
export const DEMO_TEACHER: TeacherProfile = {
  id: '00000000-0000-4000-8000-000000000001',
  fullName: 'Alex Otieno',
  headline: 'Mathematics & Computer Science Teacher',
  county: 'nairobi',
  subjects: ['mathematics', 'computer-studies'],
  curricula: ['cbc'],
  experienceYears: 5,
  hasDegree: true,
  tscNumber: '123456',
  tscVerified: true,
  openToOpportunities: true,
  skills: ['curriculum-development'],
};
