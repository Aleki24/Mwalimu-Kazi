-- Let a teacher write their own Auto-Apply log.
--
-- 0001 gave auto_apply_events a SELECT policy and nothing else, which was
-- right while nothing ran Auto-Apply. The runner lives in the app — it has to,
-- because the decision comes from packages/core and a second implementation in
-- SQL or Deno would be the one piece of logic in this codebase we cannot
-- afford to have two of. So the client is what records what it did.
--
-- Insert only. There is no update or delete policy on purpose: a log a teacher
-- can quietly edit is not a log, and the whole point of the activity list is
-- being able to see what was sent in your name.
create policy auto_apply_events_insert_own on auto_apply_events
  for insert with check (teacher_id = auth.uid());
