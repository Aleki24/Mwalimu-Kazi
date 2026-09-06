-- 0005's trigger never fired once.
--
-- Its WHEN clause was `new.published and pg_trigger_depth() = 1`, added out of
-- reflex to stop a trigger cascading into itself. But a WHEN clause is
-- evaluated *before* the trigger function is entered, so at that point the
-- depth is still 0 and the condition was never true — for any row, ever.
--
-- The guard was pointless anyway: notify_job_match() writes only to
-- `notifications`, which has no triggers, so it cannot re-enter itself. Drop
-- the depth test and keep the publish test.
--
-- Found by inserting a published job and watching zero notifications appear.
-- Nothing in the type checker or the unit tests can see this.

drop trigger jobs_notify_match on jobs;

create trigger jobs_notify_match
  after insert or update of published on jobs
  for each row
  when (new.published)
  execute function private.notify_job_match();
