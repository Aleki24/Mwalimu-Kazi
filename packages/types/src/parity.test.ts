import { describe, expect, it } from 'vitest';
import { Constants } from './database.generated';
import {
  ApplicationSource, ApplicationStage, Curriculum, EngagementKind, JobPosterKind, JobType,
  ModerationStatus, NewsTopic, NotificationKind, RatePeriod, RedFlagKind, ResourceKind,
  GenderPreference, PosterRole, ReviewCategory, SchoolRole, SchoolType, TeachingLevel,
  VerificationStatus,
} from './enums';

/**
 * The Postgres enums and the Zod enums are two declarations of one vocabulary.
 * `supabase/migrations/0001_init.sql` says "change both together" — this test is
 * what makes that true instead of aspirational. It fails the moment a value is
 * added to the database without being added here, or the other way round.
 */
describe('database and Zod enums agree', () => {
  const cases: ReadonlyArray<readonly [string, readonly string[], readonly string[]]> = [
    ['curriculum', Constants.public.Enums.curriculum, Curriculum.options],
    ['job_type', Constants.public.Enums.job_type, JobType.options],
    ['job_poster_kind', Constants.public.Enums.job_poster_kind, JobPosterKind.options],
    ['school_type', Constants.public.Enums.school_type, SchoolType.options],
    ['school_role', Constants.public.Enums.school_role, SchoolRole.options],
    ['application_stage', Constants.public.Enums.application_stage, ApplicationStage.options],
    ['application_source', Constants.public.Enums.application_source, ApplicationSource.options],
    ['verification_status', Constants.public.Enums.verification_status, VerificationStatus.options],
    ['moderation_status', Constants.public.Enums.moderation_status, ModerationStatus.options],
    ['news_topic', Constants.public.Enums.news_topic, NewsTopic.options],
    ['notification_kind', Constants.public.Enums.notification_kind, NotificationKind.options],
    ['red_flag_kind', Constants.public.Enums.red_flag_kind, RedFlagKind.options],
    ['resource_kind', Constants.public.Enums.resource_kind, ResourceKind.options],
    ['review_category', Constants.public.Enums.review_category, ReviewCategory.options],
    ['engagement_kind', Constants.public.Enums.engagement_kind, EngagementKind.options],
    ['rate_period', Constants.public.Enums.rate_period, RatePeriod.options],
    ['teaching_level', Constants.public.Enums.teaching_level, TeachingLevel.options],
    ['poster_role', Constants.public.Enums.poster_role, PosterRole.options],
    ['gender_preference', Constants.public.Enums.gender_preference, GenderPreference.options],
  ];

  it.each(cases)('%s', (_name, fromDatabase, fromZod) => {
    expect([...fromDatabase].sort()).toEqual([...fromZod].sort());
  });

  /**
   * The list above is hand-written, so until now a new Postgres enum simply was
   * not checked — the suite stayed green by not looking. This closes that: add
   * an enum to the database and forget the Zod side, and this fails.
   */
  it('covers every enum the database has', () => {
    expect(Object.keys(Constants.public.Enums).sort()).toEqual(cases.map(([n]) => n).sort());
  });
});
