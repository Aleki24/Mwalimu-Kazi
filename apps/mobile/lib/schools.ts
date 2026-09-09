import type { Tables } from '@mwalimu/types';
import { aggregateSchoolRatings, summariseRedFlags, type RatedReview } from '@mwalimu/core';
import { supabase } from './supabase';

/** A directory row: the school plus the counts the list shows. */
export interface SchoolListing {
  readonly school: Tables<'schools'>;
  readonly openings: number;
  readonly rating: number | null;
  readonly reviewCount: number;
  /**
   * Distinct kinds of open red flag. On the row it is the one number a teacher
   * scanning the directory would stop for, and it was not there at all — every
   * row said "No reviews yet" whether or not that was the interesting fact.
   */
  readonly redFlagCount: number;
}

// One select for every surface that shows reviews: the directory row, the
// school page, the reviews list, and the summary on a vacancy. Four places
// showing different subsets of the same review is how they drift apart.
const REVIEW_SELECT = `
  id, created_at, role_title, body, employment_verified,
  review_ratings ( category, score ),
  review_red_flags ( kind, reason, occurred_on )
` as const;

interface ReviewRow {
  readonly id: string;
  readonly created_at: string;
  readonly role_title: string | null;
  readonly body: string;
  readonly employment_verified: boolean;
  readonly review_ratings: ReadonlyArray<{ category: RatedReview['ratings'][number]['category']; score: number }> | null;
  readonly review_red_flags: ReadonlyArray<{
    kind: RatedReview['redFlags'][number]['kind'];
    reason: string;
    occurred_on: string | null;
  }> | null;
}

/** A review as a reader sees it: what was said, by whom in what role. */
export interface WrittenReview {
  readonly id: string;
  readonly createdAt: Date;
  readonly roleTitle: string | null;
  readonly body: string;
  /** Whether the platform confirmed the author actually taught there. */
  readonly employmentVerified: boolean;
  readonly ratings: RatedReview['ratings'];
  readonly redFlags: ReadonlyArray<{ kind: RatedReview['redFlags'][number]['kind']; reason: string }>;
}

const toWrittenReview = (row: ReviewRow): WrittenReview => ({
  id: row.id,
  createdAt: new Date(row.created_at),
  roleTitle: row.role_title,
  body: row.body,
  employmentVerified: row.employment_verified,
  ratings: row.review_ratings ?? [],
  redFlags: (row.review_red_flags ?? []).map((f) => ({ kind: f.kind, reason: f.reason })),
});

const toRatedReview = (row: ReviewRow): RatedReview => ({
  id: row.id,
  createdAt: new Date(row.created_at),
  ratings: row.review_ratings ?? [],
  redFlags: (row.review_red_flags ?? []).map((f) => ({
    kind: f.kind,
    ...(f.occurred_on === null ? {} : { occurredOn: new Date(f.occurred_on) }),
  })),
});

export async function fetchSchools(): Promise<readonly SchoolListing[]> {
  // `approved` is filtered here, not left to RLS. The policy is
  // `moderation = 'approved' OR author_id = auth.uid()`, so an author would
  // otherwise see their own pending review counted in the public average and
  // wonder why nobody else could see the rating they were looking at.
  const [schools, jobs, reviews] = await Promise.all([
    supabase.from('schools').select('*').order('name'),
    supabase.from('jobs').select('school_id').eq('published', true),
    supabase.from('school_reviews').select(`school_id, ${REVIEW_SELECT}`)
      .eq('moderation', 'approved'),
  ]);

  if (schools.error !== null) throw new Error(schools.error.message);

  const openings = new Map<string, number>();
  for (const row of jobs.data ?? []) {
    // school_id is nullable since 0008: a job posted by an individual belongs
    // to no school and must not be counted as anyone's opening.
    if (row.school_id === null) continue;
    openings.set(row.school_id, (openings.get(row.school_id) ?? 0) + 1);
  }

  const bySchool = new Map<string, RatedReview[]>();
  for (const row of (reviews.data ?? []) as unknown as Array<ReviewRow & { school_id: string }>) {
    const list = bySchool.get(row.school_id) ?? [];
    list.push(toRatedReview(row));
    bySchool.set(row.school_id, list);
  }

  const now = new Date();
  return (schools.data ?? []).map((school) => {
    const rated = bySchool.get(school.id) ?? [];
    const ratings = aggregateSchoolRatings(rated);
    return {
      school,
      openings: openings.get(school.id) ?? 0,
      rating: ratings.overall,
      reviewCount: ratings.reviewCount,
      redFlagCount: summariseRedFlags(rated, now).length,
    };
  });
}

export interface SchoolDetail {
  readonly school: Tables<'schools'>;
  readonly openings: ReadonlyArray<Pick<Tables<'jobs'>, 'id' | 'title' | 'salary_min' | 'salary_max' | 'closes_at'>>;
  readonly ratings: ReturnType<typeof aggregateSchoolRatings>;
  readonly redFlags: ReturnType<typeof summariseRedFlags>;
  readonly reviews: readonly RatedReview[];
  /** The same reviews with their text, for the list a reader actually reads. */
  readonly written: readonly WrittenReview[];
}

/**
 * A school's reputation, by id.
 *
 * For the vacancy screen: reading what teachers said before applying is the
 * reason this app exists, and the job is where the decision gets made. Same
 * select and same two aggregations as the school page, so the summary on the
 * vacancy and the detail behind it cannot disagree.
 */
export interface SchoolReputation {
  readonly ratings: ReturnType<typeof aggregateSchoolRatings>;
  readonly redFlags: ReturnType<typeof summariseRedFlags>;
}

export async function fetchSchoolReputation(
  schoolId: string, now: Date,
): Promise<SchoolReputation> {
  const { data, error } = await supabase
    .from('school_reviews').select(REVIEW_SELECT)
    .eq('school_id', schoolId).eq('moderation', 'approved');

  if (error !== null) throw new Error(error.message);
  const rated = ((data ?? []) as unknown as ReviewRow[]).map(toRatedReview);
  return { ratings: aggregateSchoolRatings(rated), redFlags: summariseRedFlags(rated, now) };
}

export async function fetchSchoolBySlug(slug: string, now: Date): Promise<SchoolDetail | null> {
  const { data: school, error } = await supabase
    .from('schools').select('*').eq('slug', slug).maybeSingle();

  if (error !== null) throw new Error(error.message);
  if (school === null) return null;

  const [jobs, reviews] = await Promise.all([
    supabase.from('jobs')
      .select('id, title, salary_min, salary_max, closes_at')
      .eq('school_id', school.id).eq('published', true)
      .order('posted_at', { ascending: false }),
    // Approved only — see fetchSchools above for why this is not left to RLS.
    supabase.from('school_reviews').select(REVIEW_SELECT).eq('school_id', school.id)
      .eq('moderation', 'approved')
      .order('created_at', { ascending: false }),
  ]);

  const rated = ((reviews.data ?? []) as unknown as ReviewRow[]).map(toRatedReview);

  return {
    school,
    openings: jobs.data ?? [],
    ratings: aggregateSchoolRatings(rated),
    redFlags: summariseRedFlags(rated, now),
    reviews: rated,
    written: ((reviews.data ?? []) as unknown as ReviewRow[]).map(toWrittenReview),
  };
}
