import type { Tables } from '@mwalimu/types';
import { supabase } from './supabase';

/**
 * Messages between a teacher and a school they applied to.
 *
 * A thread is anchored to an application, never to a pair of people. That is
 * the whole safety model: the teacher chose the contact by applying, so there
 * is no way to open a channel to someone who has not.
 */

export interface ThreadSummary {
  readonly thread: Tables<'message_threads'>;
  readonly jobTitle: string;
  readonly schoolName: string | null;
  readonly teacherId: string;
  readonly teacherName: string;
  readonly counterpartName: string;
  readonly lastMessage: Tables<'messages'> | null;
  readonly unread: number;
}

export interface ThreadMessage {
  readonly message: Tables<'messages'>;
  readonly mine: boolean;
  /**
   * Who said it, by side rather than by person: the teacher's name, or the
   * school's. A recruiter's own profile row is not readable by the teacher —
   * that is the profiles policy working as intended — so naming the individual
   * would render as "Unknown" on one side of every conversation. Naming the
   * side is also what the reader is actually dealing with, and it stays right
   * when a school has several people on the same thread.
   */
  readonly senderName: string;
}

const THREAD_SELECT = `
  id, application_id, created_at,
  applications (
    teacher_id,
    profiles ( full_name ),
    jobs ( title, schools ( name ) )
  )
` as const;

interface ThreadRow {
  readonly id: string;
  readonly application_id: string;
  readonly created_at: string;
  readonly applications: {
    teacher_id: string;
    profiles: { full_name: string } | null;
    jobs: { title: string; schools: { name: string } | null } | null;
  } | null;
}

function toSummary(
  row: ThreadRow, viewerId: string, messages: readonly Tables<'messages'>[],
): ThreadSummary {
  const teacherId = row.applications?.teacher_id ?? '';
  const teacherName = row.applications?.profiles?.full_name ?? 'A teacher';
  const schoolName = row.applications?.jobs?.schools?.name ?? null;
  return {
    thread: { id: row.id, application_id: row.application_id, created_at: row.created_at },
    jobTitle: row.applications?.jobs?.title ?? 'A role that has closed',
    schoolName,
    teacherId,
    teacherName,
    // Whichever side you are not.
    counterpartName: teacherId === viewerId ? (schoolName ?? 'The school') : teacherName,
    lastMessage: messages[messages.length - 1] ?? null,
    unread: messages.filter((m) => m.sender_id !== viewerId && m.read_at === null).length,
  };
}

/**
 * Every thread this person is in — RLS decides which, so the same call serves
 * a teacher and a recruiter without a role check here.
 */
export async function fetchThreads(viewerId: string): Promise<readonly ThreadSummary[]> {
  const { data, error } = await supabase.from('message_threads').select(THREAD_SELECT);
  if (error !== null) throw new Error(error.message);

  const rows = (data ?? []) as unknown as readonly ThreadRow[];
  if (rows.length === 0) return [];

  const { data: messages } = await supabase
    .from('messages')
    .select('*')
    .in('thread_id', rows.map((r) => r.id))
    .order('created_at', { ascending: true });

  const byThread = new Map<string, Tables<'messages'>[]>();
  for (const m of messages ?? []) {
    byThread.set(m.thread_id, [...(byThread.get(m.thread_id) ?? []), m]);
  }

  return rows
    .map((row) => toSummary(row, viewerId, byThread.get(row.id) ?? []))
    // Most recently active first; a thread with no messages yet sorts by when
    // it was opened, so it does not vanish to the bottom.
    .sort((a, b) => {
      const at = a.lastMessage?.created_at ?? a.thread.created_at;
      const bt = b.lastMessage?.created_at ?? b.thread.created_at;
      return bt.localeCompare(at);
    });
}

export interface Conversation {
  readonly summary: ThreadSummary;
  readonly messages: readonly ThreadMessage[];
}

/** One thread with its messages. The summary names both sides and the role. */
export async function fetchThread(threadId: string, viewerId: string): Promise<Conversation> {
  const { data, error } = await supabase
    .from('message_threads').select(THREAD_SELECT).eq('id', threadId).single();
  if (error !== null) throw new Error(error.message);
  const row = data as unknown as ThreadRow;

  const { data: rows, error: messagesError } = await supabase
    .from('messages').select('*').eq('thread_id', threadId)
    .order('created_at', { ascending: true });
  if (messagesError !== null) throw new Error(messagesError.message);

  const list = rows ?? [];
  const summary = toSummary(row, viewerId, list);
  return {
    summary,
    messages: list.map((message): ThreadMessage => ({
      message,
      mine: message.sender_id === viewerId,
      senderName:
        message.sender_id === summary.teacherId
          ? summary.teacherName
          : (summary.schoolName ?? 'The school'),
    })),
  };
}

export async function sendMessage(
  threadId: string, senderId: string, body: string,
): Promise<void> {
  const { error } = await supabase
    .from('messages').insert({ thread_id: threadId, sender_id: senderId, body: body.trim() });
  if (error !== null) throw new Error(error.message);
}

/** Marks the other side's messages read. Yours were never unread to you. */
export async function markThreadRead(threadId: string, viewerId: string): Promise<void> {
  const { error } = await supabase
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('thread_id', threadId)
    .neq('sender_id', viewerId)
    .is('read_at', null);
  if (error !== null) throw new Error(error.message);
}

/**
 * The thread for an application, opening it if this is the first message.
 *
 * Racy by nature — both sides may press at once — so a unique violation on
 * application_id is treated as "someone else just made it", not an error.
 */
export async function openThread(applicationId: string): Promise<string> {
  const existing = await supabase
    .from('message_threads').select('id').eq('application_id', applicationId).maybeSingle();
  if (existing.data !== null) return existing.data.id;

  const { data, error } = await supabase
    .from('message_threads').insert({ application_id: applicationId }).select('id').single();

  if (error !== null) {
    if (error.code === '23505') {
      const again = await supabase
        .from('message_threads').select('id').eq('application_id', applicationId).single();
      if (again.error !== null) throw new Error(again.error.message);
      return again.data.id;
    }
    throw new Error(error.message);
  }
  return data.id;
}
