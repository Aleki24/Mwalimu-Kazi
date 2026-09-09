import type { Tables } from '@mwalimu/types';
import type { RedFlagKind, ReviewCategory } from '@mwalimu/types';
import { supabase } from './supabase';

/**
 * The platform's own queues.
 *
 * Three trust signals in this app are asserted by nobody in particular unless
 * somebody checks them: whether a review is fit to publish, whether a school is
 * who it says it is, and whether a TSC number is real. 0016 made all three
 * unwritable by the party who benefits from them, which means they need a party
 * who can. This is that surface.
 *
 * Reads here rely on the admin policies rather than any filter of their own —
 * a non-admin calling these gets empty results, not an error, because RLS is
 * doing the work.
 */

export interface PendingReview {
  readonly review: Tables<'school_reviews'>;
  readonly schoolName: string;
  readonly schoolSlug: string;
  readonly ratings: ReadonlyArray<{ category: ReviewCategory; score: number }>;
  readonly redFlags: ReadonlyArray<{ kind: RedFlagKind; reason: string; occurredOn: string | null }>;
}

export interface AdminQueues {
  readonly reviews: readonly PendingReview[];
  readonly schools: readonly Tables<'schools'>[];
  readonly tsc: readonly Tables<'profiles'>[];
}

/** Is the signed-in person staff? Answered by RPC — see 0016 for why. */
export async function amIAdmin(): Promise<boolean> {
  const { data, error } = await supabase.rpc('am_i_platform_admin');
  if (error !== null) return false;
  return data === true;
}

const PENDING_REVIEW_SELECT = `
  *,
  schools ( name, slug ),
  review_ratings ( category, score ),
  review_red_flags ( kind, reason, occurred_on )
` as const;

interface PendingReviewRow extends Tables<'school_reviews'> {
  readonly schools: { name: string; slug: string } | null;
  readonly review_ratings: ReadonlyArray<{ category: ReviewCategory; score: number }> | null;
  readonly review_red_flags:
    ReadonlyArray<{ kind: RedFlagKind; reason: string; occurred_on: string | null }> | null;
}

export async function fetchQueues(): Promise<AdminQueues> {
  const [reviews, schools, tsc] = await Promise.all([
    supabase.from('school_reviews').select(PENDING_REVIEW_SELECT)
      .eq('moderation', 'pending').order('created_at', { ascending: true }),
    // `under_review` is a school that asked; `pending` is one mid-check. Both
    // are waiting on a person, so both belong in the queue.
    supabase.from('schools').select('*')
      .in('verification', ['pending', 'under_review']).order('name'),
    // A TSC number that nobody has checked. Profiles without one are not
    // waiting for anything.
    supabase.from('profiles').select('*')
      .not('tsc_number', 'is', null).eq('tsc_verified', false).order('full_name'),
  ]);

  if (reviews.error !== null) throw new Error(reviews.error.message);
  if (schools.error !== null) throw new Error(schools.error.message);
  if (tsc.error !== null) throw new Error(tsc.error.message);

  return {
    reviews: ((reviews.data ?? []) as unknown as readonly PendingReviewRow[]).map((row) => ({
      review: row,
      schoolName: row.schools?.name ?? 'A school that has been removed',
      schoolSlug: row.schools?.slug ?? '',
      ratings: row.review_ratings ?? [],
      redFlags: (row.review_red_flags ?? []).map((f) => ({
        kind: f.kind, reason: f.reason, occurredOn: f.occurred_on,
      })),
    })),
    schools: schools.data ?? [],
    tsc: tsc.data ?? [],
  };
}

export async function moderateReview(
  reviewId: string, decision: 'approved' | 'rejected',
): Promise<void> {
  const { error } = await supabase
    .from('school_reviews').update({ moderation: decision }).eq('id', reviewId);
  if (error !== null) throw new Error(error.message);
}

export async function setSchoolVerification(
  schoolId: string, verification: Tables<'schools'>['verification'],
): Promise<void> {
  const { error } = await supabase
    .from('schools').update({ verification }).eq('id', schoolId);
  if (error !== null) throw new Error(error.message);
}

export async function setTscVerified(profileId: string, verified: boolean): Promise<void> {
  const { error } = await supabase
    .from('profiles').update({ tsc_verified: verified }).eq('id', profileId);
  if (error !== null) throw new Error(error.message);
}
