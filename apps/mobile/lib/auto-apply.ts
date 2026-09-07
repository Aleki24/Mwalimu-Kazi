import {
  decideAutoApply, matchScore, SKIP_REASON_TEXT, type AutoApplyDecision, type JobWithSchool,
} from '@mwalimu/core';
import type { AutoApplyRule, TeacherProfile } from '@mwalimu/types';
import type { Tables, TablesInsert } from '@mwalimu/types';
import { supabase } from './supabase';
import { fetchOpenJobs } from './jobs';
import { fetchAppliedJobIds } from './applications';

/**
 * Auto-Apply.
 *
 * The decision lives in `decideAutoApply` in packages/core and is not
 * reimplemented here or anywhere else. That function is the most consequential
 * code in the app — it sends a teacher's documents to a school without them
 * looking first — and a second copy of it in SQL or in an Edge Function would
 * be the one drift this codebase genuinely cannot afford.
 *
 * The consequence is that the runner is the client: it evaluates when the
 * teacher opens the app rather than while they sleep. That is a real limit and
 * the screen says so plainly, because a teacher who believes it ran overnight
 * and finds it did not has been misled by us, not by the world.
 */

export type RuleRow = Tables<'auto_apply_rules'>;
export type EventRow = Tables<'auto_apply_events'>;

export interface AutoApplyEvent {
  readonly event: EventRow;
  readonly jobTitle: string | null;
  readonly schoolName: string | null;
}

export async function fetchRule(): Promise<RuleRow | null> {
  const { data, error } = await supabase.from('auto_apply_rules').select('*').maybeSingle();
  if (error !== null) throw new Error(error.message);
  return data;
}

export async function saveRule(row: TablesInsert<'auto_apply_rules'>): Promise<void> {
  const { error } = await supabase
    .from('auto_apply_rules')
    .upsert({ ...row, updated_at: new Date().toISOString() });
  if (error !== null) throw new Error(error.message);
}

export async function fetchEvents(limit = 30): Promise<readonly AutoApplyEvent[]> {
  const { data, error } = await supabase
    .from('auto_apply_events')
    .select('*, jobs ( title, schools ( name ) )')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error !== null) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const joined = row as unknown as EventRow & {
      jobs: { title: string; schools: { name: string } | null } | null;
    };
    return {
      event: joined,
      jobTitle: joined.jobs?.title ?? null,
      schoolName: joined.jobs?.schools?.name ?? null,
    };
  });
}

/** Map a database row onto the domain shape decideAutoApply expects. */
function toRule(row: RuleRow): AutoApplyRule {
  return {
    teacherId: row.teacher_id,
    enabled: row.enabled,
    subjects: row.subjects,
    counties: row.counties as AutoApplyRule['counties'],
    ...(row.min_salary === null ? {} : { minSalary: row.min_salary }),
    minMatchScore: row.min_match_score,
    jobTypes: row.job_types,
    excludedSchoolIds: row.excluded_school_ids,
    dailyLimit: row.daily_limit,
    weeklyLimit: row.weekly_limit,
    requireReviewBeforeSending: row.require_review_before_sending,
  };
}

export interface RunSummary {
  readonly considered: number;
  readonly applied: number;
  readonly held: number;
  readonly skipped: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Evaluate every open job against the rule and act on it.
 *
 * Limits are counted from the events table rather than tracked in memory, so
 * closing the app and reopening it cannot reset a daily cap. Sending twice
 * because the count was lost is the failure that would cost a teacher an
 * interview.
 */
export async function runAutoApply(
  teacher: TeacherProfile,
  row: RuleRow,
): Promise<RunSummary> {
  const rule = toRule(row);
  if (!rule.enabled) return { considered: 0, applied: 0, held: 0, skipped: 0 };

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * DAY_MS).toISOString();

  const [{ jobs }, appliedIds, sent] = await Promise.all([
    fetchOpenJobs(),
    fetchAppliedJobIds(),
    supabase.from('auto_apply_events')
      .select('created_at')
      .eq('outcome', 'applied')
      .gte('created_at', weekAgo),
  ]);

  const sentAt = (sent.data ?? []).map((e) => new Date(e.created_at));
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  let sentToday = sentAt.filter((d) => d >= startOfToday).length;
  let sentThisWeek = sentAt.length;

  const summary = { considered: 0, applied: 0, held: 0, skipped: 0 };
  const events: TablesInsert<'auto_apply_events'>[] = [];

  for (const entry of jobs) {
    summary.considered += 1;
    const match = matchScore(entry.job, teacher);
    const decision: AutoApplyDecision = decideAutoApply(rule, entry.job, match, {
      now,
      alreadyApplied: appliedIds.has(entry.job.id),
      sentToday,
      sentThisWeek,
    });

    if (decision.decision === 'skip') {
      summary.skipped += 1;
      // Only worth logging the near-misses. A teacher does not need a line
      // saying every Kisumu job was in the wrong county.
      if (decision.reason === 'below_min_match' || decision.reason === 'must_have_unmet') {
        events.push({
          teacher_id: teacher.id, job_id: entry.job.id, outcome: 'skipped',
          reason: SKIP_REASON_TEXT[decision.reason], match_score: match.score,
        });
      }
      continue;
    }

    if (decision.decision === 'hold_for_review') {
      summary.held += 1;
      events.push({
        teacher_id: teacher.id, job_id: entry.job.id, outcome: 'held',
        reason: 'Waiting for you to review it', match_score: match.score,
      });
      continue;
    }

    const { error } = await supabase.from('applications').insert({
      teacher_id: teacher.id, job_id: entry.job.id,
      match_score: match.score, source: 'auto_apply',
    });

    if (error !== null && error.code !== '23505') {
      events.push({
        teacher_id: teacher.id, job_id: entry.job.id, outcome: 'failed',
        reason: error.message, match_score: match.score,
      });
      continue;
    }
    // A unique violation means it was already applied to; not a failure, and
    // not something to log twice.
    if (error !== null) { summary.skipped += 1; continue; }

    summary.applied += 1;
    // Counted as we go, so the caps hold within a single run and not just
    // between runs.
    sentToday += 1;
    sentThisWeek += 1;
    events.push({
      teacher_id: teacher.id, job_id: entry.job.id, outcome: 'applied',
      reason: null, match_score: match.score,
    });
  }

  if (events.length > 0) await supabase.from('auto_apply_events').insert(events);
  return summary;
}

/** Everything the settings screen needs, in one round trip each. */
export async function fetchAutoApplyScreen(): Promise<{
  readonly rule: RuleRow | null;
  readonly events: readonly AutoApplyEvent[];
}> {
  const [rule, events] = await Promise.all([fetchRule(), fetchEvents()]);
  return { rule, events };
}

export type { JobWithSchool };
