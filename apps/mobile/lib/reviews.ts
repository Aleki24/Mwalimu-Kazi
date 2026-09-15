import type { Tables } from '@mwalimu/types';
import type { RedFlagKind, ReviewCategory } from '@mwalimu/types';
import { supabase } from './supabase';

/** Postgres unique_violation — here it means "you already reviewed this school". */
const UNIQUE_VIOLATION = '23505';

export interface DraftRating {
  readonly category: ReviewCategory;
  readonly score: number;
}

export interface DraftRedFlag {
  readonly kind: RedFlagKind;
  readonly reason: string;
  /** ISO date (yyyy-mm-dd). Undated flags are allowed; vague ones are not. */
  readonly occurredOn?: string;
}

export interface ReviewDraft {
  readonly schoolId: string;
  readonly roleTitle: string;
  readonly body: string;
  readonly ratings: readonly DraftRating[];
  readonly redFlags: readonly DraftRedFlag[];
}

export class AlreadyReviewedError extends Error {
  constructor() {
    super('You have already reviewed this school.');
    this.name = 'AlreadyReviewedError';
  }
}

/** The signed-in teacher's own review of a school, approved or not. */
export async function fetchOwnReview(
  schoolId: string,
  authorId: string,
): Promise<Tables<'school_reviews'> | null> {
  const { data, error } = await supabase
    .from('school_reviews').select('*')
    .eq('school_id', schoolId).eq('author_id', authorId)
    .maybeSingle();

  if (error !== null) throw new Error(error.message);
  return data;
}

/**
 * Submit a review through the `submit_school_review` RPC.
 *
 * Not three inserts from here: a review, its ratings and its red flags have to
 * land together. The function body is one transaction, so a failure part way
 * cannot leave a review with no ratings — a shape the domain schema says is
 * impossible and which nothing downstream could parse.
 *
 * `employmentVerified` is deliberately absent. It is what separates a review
 * that carries weight from one that does not, so the client that benefits from
 * it must not be able to assert it.
 */
export async function submitReview(draft: ReviewDraft): Promise<string> {
  const { data, error } = await supabase.rpc('submit_school_review', {
    p_school_id: draft.schoolId,
    p_role_title: draft.roleTitle,
    p_body: draft.body,
    p_ratings: draft.ratings.map((r) => ({ category: r.category, score: r.score })),
    p_red_flags: draft.redFlags.map((f) => ({
      kind: f.kind,
      reason: f.reason,
      occurred_on: f.occurredOn ?? null,
    })),
  });

  if (error !== null) {
    if (error.code === UNIQUE_VIOLATION) throw new AlreadyReviewedError();
    throw new Error(error.message);
  }
  return data;
}

/**
 * Schools this teacher could write about and has not.
 *
 * Deliberately an RPC rather than a query. Answering it means asking "which
 * schools have I already reviewed", and `school_reviews.author_id` is
 * unreadable on purpose — a review that can be traced back to its author is a
 * review nobody writes. The function answers about the caller and nobody else.
 *
 * Strongest claim first: on the staff, then met them, then answered by them.
 * Somebody who only submitted a form is not in here — that is an experience of
 * a job advert, not of a school.
 */
export interface ReviewInvitation {
  readonly schoolId: string;
  readonly schoolName: string;
  readonly schoolSlug: string;
  /** 'works_there' | 'interviewed' | 'answered'; @mwalimu/core turns it into a sentence. */
  readonly reason: string;
  readonly roleTitle: string | null;
}

export async function fetchReviewInvitations(): Promise<readonly ReviewInvitation[]> {
  const { data, error } = await supabase.rpc('reviews_i_could_write');
  if (error !== null) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    schoolId: row.school_id,
    schoolName: row.school_name,
    schoolSlug: row.school_slug,
    reason: row.reason,
    roleTitle: row.role_title,
  }));
}
