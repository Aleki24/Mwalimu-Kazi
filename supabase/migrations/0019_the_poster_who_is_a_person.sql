-- Posting a job as a person has been write-only since 0008.
--
-- Proven against the live project: a poster with no school sees 0 applications
-- to their own vacancy, cannot read the profile of anyone who applied, and
-- fails is_application_participant, so the chat their applicant opens is a
-- room they cannot enter. The form has been offering "An individual" all along
-- and it led nowhere.
--
-- Every rule that follows an application was written as "the school that
-- received it", and 0008 made school_id nullable without revisiting them:
--
--   applications_select_school     is_school_member(j.school_id)
--   applications_update_school     is_school_member(j.school_id)
--   profiles_select_applicant      j.school_id is not null and is_school_member(...)
--   is_application_participant     j.school_id is not null and <member>
--
-- The party that matters is whoever posted the vacancy. For a school that is
-- its members; for a parent looking for a tutor it is the parent.

create or replace function private.is_job_poster(target_job uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from jobs j
    where j.id = target_job and j.posted_by is not null and j.posted_by = auth.uid()
  );
$$;

revoke all on function private.is_job_poster(uuid) from public;
-- anon is granted so a signed-out read evaluates to false and returns nothing,
-- rather than failing the whole query with 42501. That was 0003's lesson.
grant execute on function private.is_job_poster(uuid) to authenticated, anon;

-- ---------------------------------------------------- seeing who applied
-- Additive policies rather than edits to the school ones: "the school that
-- received it" is still true and still readable as its own rule.
create policy applications_select_poster on applications
  for select using (
    exists (select 1 from jobs j
            where j.id = applications.job_id and private.is_job_poster(j.id))
  );

create policy applications_update_poster on applications
  for update using (
    exists (select 1 from jobs j
            where j.id = applications.job_id and private.is_job_poster(j.id))
  );

-- A teacher who applies has chosen this person, exactly as they choose a
-- school. So the poster can read the profile of someone who applied to their
-- own listing, and nobody else's — there is no browsing here, and a parent
-- gets no discoverability at all.
create policy profiles_select_applicant_of_poster on profiles
  for select using (
    exists (
      select 1
      from applications a
      join jobs j on j.id = a.job_id
      where a.teacher_id = profiles.id and private.is_job_poster(j.id)
    )
  );

-- ------------------------------------------------------------- the chat
-- Same shape as 0014, with the poster added. Still keyed off the application
-- rather than the thread row, so `insert … returning` keeps working.
create or replace function private.is_application_participant(target_application uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1
    from applications a
    join jobs j on j.id = a.job_id
    where a.id = target_application
      and (
        a.teacher_id = auth.uid()
        or (j.posted_by is not null and j.posted_by = auth.uid())
        or (j.school_id is not null and exists (
          select 1 from school_members m
          where m.school_id = j.school_id and m.user_id = auth.uid()
        ))
      )
  );
$$;

-- And the same for the thread-keyed one. Two functions ask this question:
-- is_application_participant gates the thread row (so `insert … returning`
-- works), is_thread_participant gates the messages in it. Fixing only the
-- first let the parent create a thread and then be refused when they tried to
-- say anything in it — found by writing the probe that sends a message rather
-- than one that only checks a boolean.
create or replace function private.is_thread_participant(target_thread uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1
    from message_threads t
    join applications a on a.id = t.application_id
    join jobs j on j.id = a.job_id
    where t.id = target_thread
      and (
        a.teacher_id = auth.uid()
        or (j.posted_by is not null and j.posted_by = auth.uid())
        or (j.school_id is not null and exists (
          select 1 from school_members m
          where m.school_id = j.school_id and m.user_id = auth.uid()
        ))
      )
  );
$$;

-- ------------------------------------------------ telling them about it
-- notify_message assumed the other side was a school's members. When there is
-- no school, the person who posted is the one to tell.
create or replace function private.notify_message()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_teacher     uuid;
  v_school      uuid;
  v_school_name text;
  v_posted_by   uuid;
  v_name        text;
begin
  select a.teacher_id, j.school_id, s.name, j.posted_by
    into v_teacher, v_school, v_school_name, v_posted_by
  from message_threads t
  join applications a on a.id = t.application_id
  join jobs j on j.id = a.job_id
  left join schools s on s.id = j.school_id
  where t.id = new.thread_id;

  if new.sender_id = v_teacher then
    select full_name into v_name from profiles where id = new.sender_id;
    if v_school is not null then
      insert into notifications (user_id, kind, title, body, payload)
      select m.user_id, 'message', coalesce(v_name, 'A teacher'),
             left(btrim(new.body), 140),
             jsonb_build_object('thread_id', new.thread_id)
      from school_members m
      where m.school_id = v_school;
    elsif v_posted_by is not null then
      insert into notifications (user_id, kind, title, body, payload)
      values (v_posted_by, 'message', coalesce(v_name, 'A teacher'),
              left(btrim(new.body), 140),
              jsonb_build_object('thread_id', new.thread_id));
    end if;
  else
    -- From the other side. A school speaks in the school's name; a person
    -- speaks in their own, because "A school" would be a lie about who is
    -- messaging a teacher about their child.
    if v_school_name is null then
      select full_name into v_name from profiles where id = new.sender_id;
    else
      v_name := v_school_name;
    end if;
    insert into notifications (user_id, kind, title, body, payload)
    values (v_teacher, 'message', coalesce(v_name, 'Someone'),
            left(btrim(new.body), 140),
            jsonb_build_object('thread_id', new.thread_id));
  end if;

  return new;
end;
$$;

revoke all on function private.notify_message() from public;
