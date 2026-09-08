-- Opening a thread failed on `insert ... returning id`.
--
-- The insert passed its WITH CHECK; the RETURNING clause did not. RETURNING is
-- gated by the SELECT policy, and that policy called
-- is_thread_participant(id), which looks the thread up *in message_threads* —
-- a STABLE function reading the table mid-INSERT sees the statement's
-- snapshot, which does not contain the row being written. So the check could
-- only ever be false, and the client got 42501 on the very first message.
--
-- The fix is to stop asking message_threads who is in a thread. Participation
-- was never a fact about the thread row; it is a fact about the application it
-- anchors, which is already on the row as a column. Reading application_id
-- needs no snapshot of the new row.

create or replace function private.is_application_participant(target_application uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1
    from applications a
    join jobs j on j.id = a.job_id
    where a.id = target_application
      and (
        a.teacher_id = auth.uid()
        or (j.school_id is not null and exists (
          select 1 from school_members m
          where m.school_id = j.school_id and m.user_id = auth.uid()
        ))
      )
  );
$$;

-- 0003's lesson: a policy's function must be executable by every role that can
-- reach the table, or the read fails with 42501 instead of returning nothing.
-- anon is granted so a signed-out reader simply sees an empty list.
revoke all on function private.is_application_participant(uuid) from public;
grant execute on function private.is_application_participant(uuid) to authenticated, anon;

-- Same for the thread-keyed one, which 0013 granted without revoking first.
revoke all on function private.is_thread_participant(uuid) from public;
grant execute on function private.is_thread_participant(uuid) to authenticated, anon;

drop policy message_threads_participants on message_threads;
create policy message_threads_participants on message_threads
  for select using (private.is_application_participant(application_id));

-- The insert check was this same predicate written out inline. Now that it has
-- a name, both sides of the table use one definition.
drop policy message_threads_insert on message_threads;
create policy message_threads_insert on message_threads
  for insert with check (private.is_application_participant(application_id));
