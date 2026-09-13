-- A parent reaches out to a tutor they found.
--
-- Messaging in this app hangs off an application: a thread belongs to one, and
-- that is what keeps the policies simple and the conversation attached to the
-- thing being discussed. A parent browsing the directory has no application —
-- nobody applied — so there is nothing to talk through.
--
-- Rather than loosen the threads, an invitation *creates* the missing link: the
-- parent picks which of their requests they are writing about, and the tutor is
-- attached to it with `source = 'invited'`. Every screen that already reads
-- applications then works unchanged, and the word on the card is true.
--
-- SECURITY DEFINER because the parent is inserting a row about somebody else,
-- which `applications_insert_own` rightly refuses. Everything that policy would
-- have checked is checked here instead, explicitly.

create or replace function public.invite_tutor(p_job uuid, p_tutor uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_application uuid;
  v_thread uuid;
begin
  if auth.uid() is null then
    raise exception 'sign in first' using errcode = '28000';
  end if;

  -- Yours to invite to. `is_job_poster` covers both shapes of poster: a person
  -- who posted it, and staff of the school it belongs to.
  if not private.is_job_poster(p_job) then
    raise exception 'that listing is not yours' using errcode = '42501';
  end if;

  -- Available, and therefore asking to be found. Inviting a teacher who has
  -- switched themselves off would be using the directory to reach someone who
  -- left it.
  if not exists (select 1 from tutor_profiles t where t.user_id = p_tutor and t.available) then
    raise exception 'that teacher is not offering tuition' using errcode = '42501';
  end if;

  -- Already talking is not an error: hand back the conversation they have.
  select a.id into v_application
  from applications a where a.job_id = p_job and a.teacher_id = p_tutor;

  if v_application is null then
    insert into applications (job_id, teacher_id, stage, match_score, source)
    -- Zero, and the screens know not to show it: a match score is what the
    -- client asserted when applying, and nobody applied. Inventing one here
    -- would put a number on a card that no calculation produced.
    values (p_job, p_tutor, 'applied', 0, 'invited')
    returning id into v_application;
  end if;

  select t.id into v_thread from message_threads t where t.application_id = v_application;
  if v_thread is null then
    insert into message_threads (application_id) values (v_application) returning id into v_thread;
  end if;

  return v_thread;
end;
$$;

revoke execute on function public.invite_tutor(uuid, uuid) from anon;
