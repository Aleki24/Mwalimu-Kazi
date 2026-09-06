import type { Tables } from '@mwalimu/types';
import { aggregateSchoolRatings, summariseRedFlags, type RatedReview } from '@mwalimu/core';
import { supabase } from './supabase';

/** A directory row: the school plus the counts the list shows. */
export interface SchoolListing {
  readonly school: Tables<'schools'>;
  readonly openings: number;
  readonly rating: number | null;
  readonly reviewCount: number;
}

const REVIEW_SELECT = `
  id, created_at,
  review_ratings ( category, score ),
  review_red_flags ( kind, occurred_on )
` as const;

interface ReviewRow {
  readonly id: string;
  readonly created_at: string;
  readonly review_ratings: ReadonlyArray<{ category: RatedReview['ratings'][number]['category']; score: number }> | null;
  readonly review_red_flags: ReadonlyArray<{ kind: RatedReview['redFlags'][number]['kind']; occurred_on: string | null }> | null;
}

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

  return (schools.data ?? []).map((school) => {
    const ratings = aggregateSchoolRatings(bySchool.get(school.id) ?? []);
    return {
      school,
      openings: openings.get(school.id) ?? 0,
      rating: ratings.overall,
      reviewCount: ratings.reviewCount,
    };
  });
}

export interface SchoolDetail {
  readonly school: Tables<'schools'>;
  readonly openings: ReadonlyArray<Pick<Tables<'jobs'>, 'id' | 'title' | 'salary_min' | 'salary_max' | 'closes_at'>>;
  readonly ratings: ReturnType<typeof aggregateSchoolRatings>;
  readonly redFlags: ReturnType<typeof summariseRedFlags>;
  readonly reviews: readonly RatedReview[];
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
  };
}
