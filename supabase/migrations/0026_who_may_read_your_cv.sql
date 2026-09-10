-- Who may read your CV.
--
-- Until now the answer was "nobody but you", which is a safe default and a
-- useless one: a school that shortlists a teacher has no way to read the CV
-- that teacher built here, so the teacher exports a PDF and emails it, and the
-- app is a word processor. This is the setting that makes it a place you are
-- found.
--
-- Three levels, additive, in the teacher's own terms:
--
--   private  Nobody. The CV is a document you keep here and export yourself.
--   applied  The people whose listings you answered — a school you applied to,
--            a parent whose tuition request you replied to. The default,
--            because it is the thing the teacher was trying to do by applying.
--   open     Anyone who is hiring: staff of any school, and anyone who has
--            posted a listing of their own. This is what puts a teacher in a
--            talent pool rather than a queue.
--
-- Referees do not follow that ladder, and deliberately. A referee is a named
-- third party with a phone number who agreed to vouch for one person, not to
-- be in a directory. They are readable by someone you actually applied to and
-- by nobody else, whatever the CV's level is set to — `open` is the teacher's
-- consent to be found, and it is not theirs to give on a referee's behalf.

create type cv_visibility as enum ('private', 'applied', 'open');

alter table cv_details
  add column visibility cv_visibility not null default 'applied';

/**
 * Has this viewer posted something the owner answered?
 *
 * Both shapes of poster: a school, through its staff, and a person, through
 * `jobs.posted_by`. SECURITY DEFINER because it reads `applications` and
 * `school_members`, neither of which the viewer may read in full — the answer
 * is a boolean about themselves, not a window into either table.
 */
create or replace function private.applied_to_me(owner uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select exists (
    select 1
    from applications a
    join jobs j on j.id = a.job_id
    where a.teacher_id = owner
      and (
        j.posted_by = auth.uid()
        or (j.school_id is not null and exists (
          select 1 from school_members m
          where m.school_id = j.school_id and m.user_id = auth.uid()
        ))
      )
  );
$$;

/** Is this viewer someone who hires — school staff, or anyone who has posted? */
create or replace function private.is_hiring()
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select exists (select 1 from school_members m where m.user_id = auth.uid())
      or exists (select 1 from jobs j where j.posted_by = auth.uid());
$$;

/**
 * The one rule, in one place.
 *
 * Every CV table and the photo bucket ask this same question, so a level added
 * later is added once. It reads `cv_details.visibility` through SECURITY
 * DEFINER: asking the table directly would recurse through the very policy
 * that calls it.
 */
create or replace function private.may_read_cv(owner uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select owner = auth.uid()
      or (auth.uid() is not null and exists (
        select 1 from cv_details d
        where d.user_id = owner
          and (
            (d.visibility = 'applied' and private.applied_to_me(owner))
            or (d.visibility = 'open' and (private.is_hiring() or private.applied_to_me(owner)))
          )
      ));
$$;

-- A row with no `cv_details` at all has no visibility to read, so it stays
-- private — which is the right way for the absence of a decision to fail.
create policy cv_details_readable on cv_details for select to authenticated
  using (private.may_read_cv(user_id));

create policy cv_education_readable on cv_education for select to authenticated
  using (private.may_read_cv(user_id));

create policy cv_experience_readable on cv_experience for select to authenticated
  using (private.may_read_cv(user_id));

create policy cv_certificates_readable on cv_certificates for select to authenticated
  using (private.may_read_cv(user_id));

-- Stricter, per the note above: someone this teacher actually applied to, AND
-- only while the CV is readable at all. Written without the second half first,
-- and a probe caught it: a teacher who had set their CV to `private` still
-- handed their referees' phone numbers to every school they had applied to.
-- Private has to mean private, and a rule that reads one column has to read
-- the one that turns it off.
create policy cv_referees_readable on cv_referees for select to authenticated
  using (
    user_id = auth.uid()
    or (private.applied_to_me(user_id) and private.may_read_cv(user_id))
  );

-- The photograph follows the CV it belongs to. The folder is the owner's id,
-- which is what makes this checkable at all.
drop policy if exists cv_photos_own_read on storage.objects;
create policy cv_photos_readable on storage.objects for select to authenticated
  using (
    bucket_id = 'cv-photos'
    and private.may_read_cv(((storage.foldername(name))[1])::uuid)
  );
