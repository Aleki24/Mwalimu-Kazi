-- What a teacher needs to know before answering, and what a poster needs to
-- say to get the right person.
--
-- A request used to carry a single `delivery` mode, which could not express
-- the common case: "I can teach online or come to you, but I cannot host."
-- Three independent facts replace it, and they are what the icon row on the
-- card shows — lit when true, greyed when not, so a teacher can scan a list
-- and tell at a glance which ones they can physically do.

alter table jobs
  add column meets_online boolean not null default false,
  add column meets_at_student boolean not null default false,
  add column meets_at_teacher boolean not null default false;

-- Carry the old single mode across rather than losing it.
update jobs set
  meets_online     = (delivery in ('online', 'either')),
  meets_at_student = (delivery in ('in_person', 'either'))
where delivery is not null;

alter table jobs drop constraint jobs_private_request_is_answerable;
alter table jobs drop column delivery;
drop type teaching_mode;

-- A request nobody can physically attend is not a request.
alter table jobs add constraint jobs_private_request_is_answerable check (
  engagement = 'employment'
  or (
    (meets_online or meets_at_student or meets_at_teacher)
    and area is not null and btrim(area) <> ''
  )
);

-- How far along the learner is. Not the teacher's qualification — a beginner
-- adult learner and a Form 4 candidate need different people.
create type teaching_level as enum ('beginner', 'intermediate', 'expert');
alter table jobs add column level teaching_level;

/*
  Who is asking. "Posted by Mary Wambui (Parent)" tells a teacher something
  that changes how they read the rest of it — a professional agency and a
  mother are not the same counterparty.
*/
create type poster_role as enum ('parent', 'student', 'professional', 'school');
alter table jobs add column poster_role poster_role;

/*
  A preference, and only on private requests.

  A family wanting a female tutor for a daughter at home is ordinary and legal.
  A school filtering applicants by sex is unlawful under the Employment Act,
  and the constraint is what stops this field quietly becoming that. It is
  never a filter on the teacher's side either — it is shown, so a teacher can
  decide whether to bother, and that is all.
*/
create type gender_preference as enum ('any', 'female', 'male');
alter table jobs add column preferred_gender gender_preference;
alter table jobs add constraint jobs_gender_preference_is_private_only check (
  preferred_gender is null or preferred_gender = 'any' or engagement <> 'employment'
);

-- "Prefers tutors from Kasarani" — a county or an area, not a nationality.
alter table jobs add column prefers_locality text
  check (prefers_locality is null or char_length(btrim(prefers_locality)) between 2 and 80);

/*
  The poster's name, copied onto the listing rather than read from their
  profile.

  The Contact button names the person, which needs a name a browsing teacher
  can see — and RLS is row-level, so a policy exposing the name would expose
  the TSC number and everything else on the row with it. Denormalising one
  field is the version where a listing says who posted it and a profile stays
  private.
*/
alter table jobs add column posted_by_name text;

create or replace function private.set_job_provenance()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is not null then
    new.posted_by := auth.uid();
  end if;

  new.poster_kind := case
    when new.school_id is not null then 'school'
    when private.is_platform_admin() then 'platform'
    else 'individual'
  end;

  -- Always from the profile, never from the client: a listing that can name
  -- someone else as its author is a forgery tool, and that applies to the
  -- display name exactly as it does to posted_by.
  if new.posted_by is not null then
    select full_name into new.posted_by_name from profiles where id = new.posted_by;
  end if;

  return new;
end;
$$;

-- The old trigger only fired when school_id was written, which was enough when
-- provenance depended on nothing else. The name has to be filled on every
-- insert.
drop trigger jobs_set_provenance on jobs;
create trigger jobs_set_provenance
  before insert or update of school_id on jobs
  for each row execute function private.set_job_provenance();

-- Backfill the listings that already exist.
update jobs j set posted_by_name = p.full_name
from profiles p where p.id = j.posted_by and j.posted_by_name is null;
