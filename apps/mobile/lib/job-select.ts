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
  schools ( name, slug, school_type, curricula, verification )
` as const;
