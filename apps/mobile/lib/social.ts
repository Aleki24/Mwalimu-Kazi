import type { Tables } from '@mwalimu/types';
import { supabase } from './supabase';

/**
 * Comments and the teacher feed.
 *
 * Comments are attributed; reviews are not. That asymmetry is deliberate:
 * asking a public question about a vacancy is a normal act, while naming a bad
 * employer is not safe to do under your own name, so the two must never share
 * a model.
 */

/** An author, as a reader sees them. Never the raw profile row. */
export interface CommentAuthor {
  readonly id: string;
  readonly fullName: string;
  readonly headline: string | null;
}

export interface Comment {
  readonly id: string;
  readonly body: string;
  readonly createdAt: Date;
  readonly author: CommentAuthor | null;
}

const AUTHOR_SELECT = 'profiles ( id, full_name, headline )' as const;

interface AuthorJoin {
  readonly profiles: { id: string; full_name: string; headline: string | null } | null;
}

const toAuthor = (row: AuthorJoin): CommentAuthor | null =>
  row.profiles === null
    ? null
    : { id: row.profiles.id, fullName: row.profiles.full_name, headline: row.profiles.headline };

const toComment = (row: AuthorJoin & { id: string; body: string; created_at: string }): Comment => ({
  id: row.id,
  body: row.body,
  createdAt: new Date(row.created_at),
  author: toAuthor(row),
});

// ------------------------------------------------------------- job comments

export async function fetchJobComments(jobId: string): Promise<readonly Comment[]> {
  const { data, error } = await supabase
    .from('job_comments')
    .select(`id, body, created_at, ${AUTHOR_SELECT}`)
    .eq('job_id', jobId)
    .order('created_at', { ascending: true });

  if (error !== null) throw new Error(error.message);
  return (data ?? []).map((r) => toComment(r as unknown as Parameters<typeof toComment>[0]));
}

export async function addJobComment(
  jobId: string, authorId: string, body: string,
): Promise<void> {
  const { error } = await supabase
    .from('job_comments').insert({ job_id: jobId, author_id: authorId, body: body.trim() });
  if (error !== null) throw new Error(error.message);
}

// -------------------------------------------------------------------- feed

export interface FeedPost {
  readonly post: Tables<'posts'>;
  readonly author: CommentAuthor | null;
  readonly likeCount: number;
  readonly likedByMe: boolean;
  readonly commentCount: number;
}

export const FEED_PAGE_SIZE = 20;

export interface FeedPage {
  readonly posts: readonly FeedPost[];
  readonly next: string | null;
}

/**
 * One page of the feed, newest first, keyset on created_at.
 *
 * Counts come back as aggregates from the join rather than as a stored column,
 * so a like count can never drift away from the rows that produced it.
 */
export async function fetchFeedPage(
  cursor: string | null, viewerId: string,
): Promise<FeedPage> {
  let query = supabase
    .from('posts')
    .select(`
      id, author_id, body, created_at,
      profiles ( id, full_name, headline ),
      post_likes ( user_id ),
      post_comments ( id )
    `)
    .order('created_at', { ascending: false })
    .limit(FEED_PAGE_SIZE);

  if (cursor !== null) query = query.lt('created_at', cursor);

  const { data, error } = await query;
  if (error !== null) throw new Error(error.message);

  const rows = (data ?? []) as unknown as ReadonlyArray<
    AuthorJoin & {
      id: string; author_id: string; body: string; created_at: string;
      post_likes: ReadonlyArray<{ user_id: string }> | null;
      post_comments: ReadonlyArray<{ id: string }> | null;
    }
  >;

  const posts = rows.map((row) => {
    const likes = row.post_likes ?? [];
    return {
      post: {
        id: row.id, author_id: row.author_id, body: row.body, created_at: row.created_at,
      },
      author: toAuthor(row),
      likeCount: likes.length,
      likedByMe: likes.some((l) => l.user_id === viewerId),
      commentCount: (row.post_comments ?? []).length,
    };
  });

  const last = rows[rows.length - 1];
  const next = rows.length < FEED_PAGE_SIZE || last === undefined ? null : last.created_at;
  return { posts, next };
}

export async function createPost(authorId: string, body: string): Promise<void> {
  const { error } = await supabase.from('posts').insert({ author_id: authorId, body: body.trim() });
  if (error !== null) throw new Error(error.message);
}

export async function setPostLike(
  postId: string, userId: string, liked: boolean,
): Promise<void> {
  const { error } = liked
    ? await supabase.from('post_likes').insert({ post_id: postId, user_id: userId })
    : await supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', userId);

  // Liking twice is the same outcome as liking once, not a failure to report.
  if (error !== null && error.code !== '23505') throw new Error(error.message);
}

export async function fetchPostComments(postId: string): Promise<readonly Comment[]> {
  const { data, error } = await supabase
    .from('post_comments')
    .select(`id, body, created_at, ${AUTHOR_SELECT}`)
    .eq('post_id', postId)
    .order('created_at', { ascending: true });

  if (error !== null) throw new Error(error.message);
  return (data ?? []).map((r) => toComment(r as unknown as Parameters<typeof toComment>[0]));
}

export async function addPostComment(
  postId: string, authorId: string, body: string,
): Promise<void> {
  const { error } = await supabase
    .from('post_comments').insert({ post_id: postId, author_id: authorId, body: body.trim() });
  if (error !== null) throw new Error(error.message);
}
