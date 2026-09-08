-- Messaging between a teacher and the school they applied to.
--
-- Deliberately NOT general-purpose direct messages. This app exists partly so
-- teachers can say what a school was like without being retaliated against;
-- an open inbox anyone could write to would hand every reviewer's identity a
-- channel for pressure. A thread therefore has exactly one anchor — an
-- application — which means the teacher chose the contact by applying, and it
-- disappears with the application.

create table message_threads (
  id             uuid primary key default gen_random_uuid(),
  -- One thread per application, enforced by the database rather than by the
  -- app remembering to look first.
  application_id uuid not null unique references applications on delete cascade,
  created_at     timestamptz not null default now()
);

create table messages (
  id         uuid primary key default gen_random_uuid(),
  thread_id  uuid not null references message_threads on delete cascade,
  sender_id  uuid not null references profiles on delete cascade,
  body       text not null check (char_length(btrim(body)) between 1 and 4000),
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index messages_thread_idx on messages (thread_id, created_at);

alter table message_threads enable row level security;
alter table messages        enable row level security;

-- Who is in a thread: the teacher who applied, and the members of the school
-- whose vacancy they applied to. SECURITY DEFINER so the policy can follow
-- application -> job -> school_members without each of those tables' own RLS
-- having to allow the lookup.
create or replace function private.is_thread_participant(target_thread uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from message_threads t
    join applications a on a.id = t.application_id
    join jobs j on j.id = a.job_id
    where t.id = target_thread
      and (
        a.teacher_id = auth.uid()
        or (j.school_id is not null and exists (
          select 1 from school_members m
          where m.school_id = j.school_id and m.user_id = auth.uid()
        ))
      )
  );
$$;
-- Granted to authenticated only: there is nothing here for a signed-out
-- reader, unlike the job policies that anon must be able to evaluate.
grant execute on function private.is_thread_participant(uuid) to authenticated;

create policy message_threads_participants on message_threads
  for select using (private.is_thread_participant(id));

-- Either side may open the thread; in practice the school does, when it
-- replies to an application. The check re-derives participation rather than
-- trusting the inserted row.
create policy message_threads_insert on message_threads
  for insert with check (
    exists (
      select 1 from applications a join jobs j on j.id = a.job_id
      where a.id = application_id
        and (
          a.teacher_id = auth.uid()
          or (j.school_id is not null and private.is_school_member(j.school_id))
        )
    )
  );

create policy messages_read on messages
  for select using (private.is_thread_participant(thread_id));

-- You may only send as yourself, and only into a thread you are in.
create policy messages_insert on messages
  for insert with check (
    sender_id = auth.uid() and private.is_thread_participant(thread_id)
  );

-- Marking as read is the only update. No edit and no delete: a message you
-- can rewrite after it is read is not a record of what was said, and this
-- thread may be the evidence in a dispute about a job offer.
create policy messages_mark_read on messages
  for update using (private.is_thread_participant(thread_id))
  with check (private.is_thread_participant(thread_id));

-- ------------------------------------------------------------- notification
create or replace function private.notify_message()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_teacher uuid;
  v_school  uuid;
  v_name    text;
begin
  select a.teacher_id, j.school_id into v_teacher, v_school
  from message_threads t
  join applications a on a.id = t.application_id
  join jobs j on j.id = a.job_id
  where t.id = new.thread_id;

  select full_name into v_name from profiles where id = new.sender_id;

  if new.sender_id = v_teacher then
    -- From the teacher: tell the school's people, not the teacher themselves.
    insert into notifications (user_id, kind, title, body, payload)
    select m.user_id, 'message', coalesce(v_name, 'A teacher'),
           left(btrim(new.body), 140),
           jsonb_build_object('thread_id', new.thread_id)
    from school_members m
    where v_school is not null and m.school_id = v_school;
  else
    insert into notifications (user_id, kind, title, body, payload)
    values (v_teacher, 'message', coalesce(v_name, 'A school'),
            left(btrim(new.body), 140),
            jsonb_build_object('thread_id', new.thread_id));
  end if;

  return new;
end;
$$;

revoke all on function private.notify_message() from public;

create trigger messages_notify
  after insert on messages
  for each row execute function private.notify_message();
