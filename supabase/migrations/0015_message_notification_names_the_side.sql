-- A message notification named the individual recruiter who typed it, while
-- the thread it links to names the school. The teacher cannot read that
-- recruiter's profile row anyway (the profiles policy only opens the other
-- direction, school -> applicant), so the notification was showing a name
-- that appears nowhere else in their app.
--
-- Name the side instead, exactly as the thread does: the school to the
-- teacher, the teacher to the school.

create or replace function private.notify_message()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_teacher     uuid;
  v_school      uuid;
  v_school_name text;
  v_name        text;
begin
  select a.teacher_id, j.school_id, s.name
    into v_teacher, v_school, v_school_name
  from message_threads t
  join applications a on a.id = t.application_id
  join jobs j on j.id = a.job_id
  left join schools s on s.id = j.school_id
  where t.id = new.thread_id;

  if new.sender_id = v_teacher then
    -- From the teacher: tell the school's people, not the teacher themselves.
    select full_name into v_name from profiles where id = new.sender_id;
    insert into notifications (user_id, kind, title, body, payload)
    select m.user_id, 'message', coalesce(v_name, 'A teacher'),
           left(btrim(new.body), 140),
           jsonb_build_object('thread_id', new.thread_id)
    from school_members m
    where v_school is not null and m.school_id = v_school;
  else
    insert into notifications (user_id, kind, title, body, payload)
    values (v_teacher, 'message', coalesce(v_school_name, 'A school'),
            left(btrim(new.body), 140),
            jsonb_build_object('thread_id', new.thread_id));
  end if;

  return new;
end;
$$;

revoke all on function private.notify_message() from public;
