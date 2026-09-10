/**
 * The columns every job query selects, in one place.
 *
 * This string was copied into four files. Adding `verification` to it meant
 * editing four call sites, and missing one would have shown an unverified
 * school as if it were checked on exactly the screens I forgot — which is the
 * class of drift that hid this gap to begin with.
 */
export const JOB_SELECT = `
  id, school_id, title, subjects, job_type, county,
  salary_min, salary_max, requirements, published,
  posted_at, closes_at, created_at, posted_by, poster_kind,
  engagement, rate_period, area, learner_level, sessions_per_week,
  meets_online, meets_at_student, meets_at_teacher,
  level, poster_role, preferred_gender, prefers_locality, posted_by_name,
  schools ( name, slug, school_type, curricula, verification )
` as const;
