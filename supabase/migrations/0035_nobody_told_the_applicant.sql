-- Nobody told the applicant.
--
-- A teacher applies. Somebody at the school opens the card, taps Shortlisted,
-- and the app does exactly one thing with that: it changes a word on the
-- recruiter's own screen. The teacher is told nothing, and finds out only if
-- they happen to reopen /applications and read the line.
--
-- That is not a missing notification. It is the whole reason the pipeline
-- exists — a school moving somebody along is a message to that person, and
-- storing it without sending it turns the six stages into a private filing
-- system. `notification_kind` has had the words for this since 0004:
-- application_viewed, shortlisted, interview_invite, rejected. Nothing has
-- ever written one.
--
-- Three things here.
--
--   1. A decision can carry something with it. An interview without a time is
--      not an invitation, and "rejected" with nothing attached is the thing
--      every Kenyan teacher on every jobs board already complains about. So
--      the row gains a note, a time and a place, and the interview stage now
--      requires enough to act on.
--
--   2. The applicant hears about it, from a trigger rather than from the
--      client. A notification written by whoever happens to press the button
--      is a notification that gets forgotten the first time another screen
--      moves a stage — and it would be forgeable, since the recruiter already
--      holds UPDATE on the row.
--
--   3. The applicant can withdraw. `withdrawn` has been in the stage enum
--      from the start and no policy has ever let the teacher reach it: they
--      hold no UPDATE on applications at all. They get one here, narrowed by
--      a guard to the single thing that is theirs to say.

-- ------------------------------------------------ what a decision carries

alter table applications
  add column decided_at      timestamptz,
  add column decision_note   text,
  add column interview_at    timestamptz,
  add column interview_place text;

alter table applications
  add constraint applications_note_is_a_note
    check (decision_note is null or char_length(btrim(decision_note)) between 4 and 600),
  add constraint applications_place_is_a_place
    check (interview_place is null or char_length(btrim(interview_place)) between 2 and 120),
  -- An invitation with no time and no word about it is not an invitation. A
  -- place stays optional on purpose: plenty of first rounds are a phone call.
  add constraint applications_interview_says_when
    check (stage <> 'interview' or interview_at is not null or decision_note is not null);

comment on column applications.decision_note is
  'What the school said when they moved this along. Shown to the applicant.';

-- ------------------------------------------------------- when it was decided

create or replace function private.stamp_application_decision()
returns trigger language plpgsql security invoker set search_path = public, pg_temp as $$
begin
  if new.stage is distinct from old.stage
     and new.stage in ('viewed', 'shortlisted', 'interview', 'offered', 'rejected') then
    new.decided_at := now();
  end if;
  return new;
end;
$$;
revoke all on function private.stamp_application_decision() from public;

create trigger applications_stamp_decision
  before update on applications
  for each row execute function private.stamp_application_decision();

-- -------------------------------------------- and the applicant is told

create or replace function private.notify_application_stage()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_kind  notification_kind;
  v_title text;
  v_body  text;
  v_job   jobs%rowtype;
  v_who   text;
  v_when  text;
begin
  if new.stage is not distinct from old.stage then return new; end if;

  select * into v_job from jobs where id = new.job_id;
  if not found then return new; end if;

  -- A school by its name; a person by theirs. `posted_by_name` is what an
  -- individual listing carries, and a notification that said "a school" about
  -- a parent looking for a tutor would be the app inventing an employer.
  v_who := coalesce(
    (select s.name from schools s where s.id = v_job.school_id),
    v_job.posted_by_name,
    'The person who posted it');

  if new.stage = 'viewed' then
    v_kind := 'application_viewed';
    v_title := 'Your application was opened';
    v_body := format('%s has read your application for %s.', v_who, v_job.title);
  elsif new.stage = 'shortlisted' then
    v_kind := 'shortlisted';
    v_title := 'You have been shortlisted';
    v_body := format('%s has shortlisted you for %s.', v_who, v_job.title);
  elsif new.stage = 'interview' then
    v_kind := 'interview_invite';
    v_title := 'You have been invited to an interview';
    -- Africa/Nairobi rather than UTC. The reader is in Kenya and a time they
    -- have to convert is a time they will get wrong.
    v_when := case when new.interview_at is null then null else
                to_char(new.interview_at at time zone 'Africa/Nairobi', 'FMDay FMDD FMMonth')
                || ' at '
                || to_char(new.interview_at at time zone 'Africa/Nairobi', 'FMHH12:MIam')
              end;
    -- " on Tuesday 6 October at 9:30am, the staff room". Not an em dash: the
    -- title often has one of its own, and two in a sentence read as a typo.
    v_body := format('%s would like to meet you about %s%s%s.',
      v_who, v_job.title,
      coalesce(' on ' || v_when, ''),
      coalesce(', ' || nullif(btrim(coalesce(new.interview_place, '')), ''), ''));
  elsif new.stage = 'offered' then
    v_kind := 'offered';
    v_title := 'You have been offered the role';
    v_body := format('%s has offered you %s.', v_who, v_job.title);
  elsif new.stage = 'rejected' then
    v_kind := 'rejected';
    v_title := 'Not this time';
    v_body := format('%s is not taking your application for %s further.', v_who, v_job.title);
  else
    -- saved, applied and withdrawn are the teacher's own doing. Telling
    -- somebody what they just did themselves is noise.
    return new;
  end if;

  if new.decision_note is not null
     and new.decision_note is distinct from old.decision_note then
    v_body := v_body || ' ' || btrim(new.decision_note);
  end if;

  insert into notifications (user_id, kind, title, body, payload)
  values (new.teacher_id, v_kind, v_title, v_body,
          jsonb_build_object('application_id', new.id, 'job_id', new.job_id));

  return new;
end;
$$;
revoke all on function private.notify_application_stage() from public;

create trigger applications_notify_stage
  after update on applications
  for each row execute function private.notify_application_stage();

-- ------------------------------------------------- and can walk away from it

create policy applications_withdraw_teacher on applications
  for update using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());

-- The policy above hands a teacher UPDATE on their own application, which is
-- every column of it. What they may actually change is one word.
create or replace function private.guard_application_decision()
returns trigger language plpgsql security invoker set search_path = public, pg_temp as $$
begin
  if auth.uid() is null or auth.uid() is distinct from old.teacher_id then
    return new;
  end if;

  if new.stage is distinct from old.stage and new.stage <> 'withdrawn' then
    raise exception 'an applicant does not decide their own application'
      using errcode = 'insufficient_privilege';
  end if;

  if new.decision_note   is distinct from old.decision_note
  or new.interview_at    is distinct from old.interview_at
  or new.interview_place is distinct from old.interview_place
  or new.decided_at      is distinct from old.decided_at
  or new.match_score     is distinct from old.match_score
  or new.source          is distinct from old.source
  or new.job_id          is distinct from old.job_id
  or new.teacher_id      is distinct from old.teacher_id then
    raise exception 'an applicant does not rewrite the record of their application'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;
revoke all on function private.guard_application_decision() from public;

-- Before the stamp, so a withdrawal is refused rather than dated.
create trigger applications_guard_decision
  before update on applications
  for each row execute function private.guard_application_decision();

-- -------------------------------------------------- a school may ask to be checked

create or replace function private.is_school_admin(target_school uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from school_members m
    where m.school_id = target_school and m.user_id = auth.uid() and m.role = 'admin'
  );
$$;
-- No revoke here, unlike the triggers above. `guard_trust_flags` is SECURITY
-- INVOKER, so it runs as `authenticated` and has to be able to call this — the
-- same reason is_school_member and is_job_poster are callable. The first draft
-- revoked it and the guard died with "permission denied for function
-- is_school_admin", which read as the school being refused rather than as the
-- check being unable to run.

-- 0016 shut the door on a school verifying itself, and shut it on asking too:
-- the admin screen has always read `under_review` as "a school that asked" and
-- nothing could ever put a school there. Asking is not granting, so the one
-- move a school's own admin may make is into the queue.
create or replace function private.guard_trust_flags()
returns trigger language plpgsql security invoker set search_path = public, pg_temp as $$
begin
  if auth.uid() is null or private.is_platform_admin() then
    return new;
  end if;

  if tg_table_name = 'school_reviews' then
    if new.moderation is distinct from old.moderation then
      raise exception 'a review is published by a moderator, not by its author'
        using errcode = 'insufficient_privilege';
    end if;
  elsif tg_table_name = 'profiles' then
    if new.tsc_verified is distinct from old.tsc_verified then
      raise exception 'TSC verification is granted by the platform, not by the teacher'
        using errcode = 'insufficient_privilege';
    end if;
  elsif tg_table_name = 'schools' then
    if new.verification is distinct from old.verification then
      if not (old.verification = 'unverified'
              and new.verification = 'under_review'
              and private.is_school_admin(old.id)) then
        raise exception 'a school does not verify itself'
          using errcode = 'insufficient_privilege';
      end if;
    end if;
  end if;

  return new;
end;
$$;
