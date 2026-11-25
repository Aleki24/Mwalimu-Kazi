-- A parent is not a teacher.
--
-- Every account in this app has been a teacher's. A parent looking for a tutor
-- had to fill in teacher onboarding — subjects they teach, years in the
-- classroom, a TSC number — to reach the one screen they came for, and then
-- landed on a career dashboard about applying for jobs they do not want.
--
-- The column is additive and defaults to 'teacher', so every row that exists
-- today keeps the meaning it already had.

create type account_role as enum ('teacher', 'parent');

alter table profiles
  add column role account_role not null default 'teacher';

-- A parent's row is not a candidate.
--
-- `profiles_select_discoverable` let anyone recruiting for a verified school
-- read any profile that was open to opportunities, and a new row is open to
-- opportunities by default. Without the role test a parent would become
-- readable by every recruiter in the product the moment they signed up —
-- their name, county and phone, in a list of people looking for teaching
-- posts. The client could filter them out of the list it draws; the database
-- is where it actually has to be true.
drop policy profiles_select_discoverable on profiles;
create policy profiles_select_discoverable on profiles
  for select using (
    role = 'teacher'
    and open_to_opportunities
    and exists (
      select 1 from school_members m
      join schools s on s.id = m.school_id
      where m.user_id = auth.uid() and s.verification = 'verified'
    )
  );

-- `private.notify_job_match` needs no change: it selects teachers whose
-- `subjects` overlap the job's, and a parent has none, so the overlap is empty
-- and the notification never reaches them. Said here because the next person
-- to read that function will wonder.

comment on column profiles.role is
  'teacher: looking for teaching work. parent: looking for a tutor for a child.';
