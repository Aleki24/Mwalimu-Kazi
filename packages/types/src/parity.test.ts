import { describe, expect, it } from 'vitest';
import { Constants } from './database.generated';
import {
  ApplicationSource, ApplicationStage, Curriculum, JobType, SchoolType, VerificationStatus,
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
    ['school_type', Constants.public.Enums.school_type, SchoolType.options],
    ['application_stage', Constants.public.Enums.application_stage, ApplicationStage.options],
    ['application_source', Constants.public.Enums.application_source, ApplicationSource.options],
    ['verification_status', Constants.public.Enums.verification_status, VerificationStatus.options],
  ];

  it.each(cases)('%s', (_name, fromDatabase, fromZod) => {
    expect([...fromDatabase].sort()).toEqual([...fromZod].sort());
  });
});
