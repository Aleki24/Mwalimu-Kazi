-- Fan a `job_match` notification out to matching teachers the moment a job is
-- published.
--
-- Why the score is not stored here: packages/core/src/match.ts is the single
-- matcher, shared by the teacher's job list and the recruiter's candidate view.
-- Re-implementing it in PL/pgSQL would give us two, and they would drift on the
-- first weighting change. So SQL does candidate *selection* only — cheap,
-- indexable predicates — and the client scores each row live against the
-- teacher's current profile. A teacher who adds a subject tomorrow sees
-- yesterday's notification re-scored, which is the behaviour we want anyway.
--
-- SECURITY DEFINER because the inserting recruiter has no rights to write rows
-- into other users' notification feeds, and must not be granted them: the
-- notifications RLS policy is owner-only and stays that way.

-- One notification per teacher per job, whatever happens to `published` later.
-- Unpublishing and republishing a listing is a normal editorial action and must
-- not re-alert everyone. Expressed as a partial unique index rather than a
-- check inside the function so the guarantee survives any future writer.
create unique index notifications_job_match_once
  on notifications (user_id, ((payload ->> 'job_id')))
  where kind = 'job_match';

create or replace function private.notify_job_match()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  school_name text;
  salary_text text;
begin
  select s.name into school_name from schools s where s.id = new.school_id;
  if school_name is null then
    return new;  -- orphan job; nothing sensible to say
  end if;

  salary_text := case
    when new.salary_min is null then 'Salary not stated'
    when new.salary_max is null then 'From KSh ' || to_char(new.salary_min, 'FM999,999')
    else 'KSh ' || to_char(new.salary_min, 'FM999,999') || '–' || to_char(new.salary_max, 'FM999,999')
  end;

  insert into notifications (user_id, kind, title, body, payload)
  select
    p.id,
    'job_match',
    new.title,
    -- Sentence case, and it says what the role is rather than shouting
    -- "NEW JOB!". The match score is added by the client, live.
    school_name || ' · ' || initcap(replace(new.county, '-', ' ')) || ' · ' || salary_text,
    jsonb_build_object('job_id', new.id, 'school_id', new.school_id)
  from profiles p
  where p.open_to_opportunities
    -- Array overlap: the teacher teaches at least one subject this role wants.
    and p.subjects && new.subjects
    -- County is the only location signal a profile carries. Without it a
    -- Mathematics teacher in Kisumu hears about every Mathematics role in the
    -- country, and stops reading notifications altogether.
    and p.county = new.county
    -- Never notify someone about a vacancy at their own school.
    and not exists (
      select 1 from school_members m
      where m.school_id = new.school_id and m.user_id = p.id
    )
  on conflict do nothing;

  return new;
end;
$$;

revoke all on function private.notify_job_match() from public;

-- `update of published` rather than a bare update: editing a live job's
-- description should not re-run the fan-out at all, and the unique index is a
-- backstop, not the design.
create trigger jobs_notify_match
  after insert or update of published on jobs
  for each row
  when (new.published and pg_trigger_depth() = 1)
  execute function private.notify_job_match();
