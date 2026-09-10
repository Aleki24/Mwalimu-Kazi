-- Fixture accounts and content for driving the app in a browser.
--
-- THIS WRITES TO WHATEVER PROJECT YOU RUN IT AGAINST, and this repo has one
-- project. Everything it creates is namespaced — `alexotieno293+fx*` emails and
-- the `fixture-*` slugs — and the first block deletes exactly those, so the
-- file is re-runnable and cannot touch a real account or a real school.
--
-- Written because the same fixtures were hand-rebuilt three times in one
-- session, and a rig you retype is a rig you get subtly wrong.
--
-- The password is NOT in this file. Set it for the session first:
--
--   select set_config('fixture.password', '<a throwaway password>', false);
--
-- It lived here as a literal until GitGuardian flagged the commit, correctly:
-- a password in a repo is a password in the repo's history, and this one would
-- have recreated known-credential accounts every time somebody ran the file.
--
-- The auth.users insert fills the token columns with '' rather than leaving
-- them NULL: GoTrue scans them into non-nullable Go strings, and a NULL there
-- makes every sign-in fail with "Database error querying schema".

begin;

-- Fail loudly rather than seeding accounts with an empty password.
do $$
begin
  if coalesce(current_setting('fixture.password', true), '') = '' then
    raise exception
      'set the fixture password first: select set_config(''fixture.password'', ''<throwaway>'', false);';
  end if;
end $$;

-- ---------------------------------------------------------------- teardown
delete from schools where slug like 'fixture-%';
delete from auth.users where email like 'alexotieno293+fx%@gmail.com';

-- ------------------------------------------------------------------ people
create temp table fx (id uuid, email text, name text, role text) on commit drop;
insert into fx values
  ('00000000-0000-4000-8000-0000000000f1', 'alexotieno293+fxteacher@gmail.com', 'Grace Achieng', 'teacher'),
  ('00000000-0000-4000-8000-0000000000f2', 'alexotieno293+fxrecruiter@gmail.com', 'Daniel Mutiso', 'recruiter'),
  ('00000000-0000-4000-8000-0000000000f3', 'alexotieno293+fxadmin@gmail.com', 'Fixture Moderator', 'admin'),
  -- A parent looking for a tutor. Also a teacher, because in this app they
  -- usually are: nothing gates who may post a request.
  ('00000000-0000-4000-8000-0000000000f4', 'alexotieno293+fxparent@gmail.com', 'Mary Wambui', 'parent');

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new,
  email_change_token_current, email_change, phone_change, phone_change_token,
  reauthentication_token
)
select '00000000-0000-0000-0000-000000000000', f.id, 'authenticated', 'authenticated',
       f.email,
       extensions.crypt(current_setting('fixture.password'), extensions.gen_salt('bf')), now(),
       '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(),
       '', '', '', '', '', '', '', ''
from fx f;

insert into auth.identities (id, user_id, provider_id, identity_data, provider,
                            last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), f.id, f.id::text,
       jsonb_build_object('sub', f.id::text, 'email', f.email, 'email_verified', true),
       'email', now(), now(), now()
from fx f;

-- A teacher with a TSC number nobody has checked, so the admin queue has one.
insert into profiles (id, full_name, headline, county, subjects, curricula,
                      experience_years, has_degree, tsc_number, tsc_verified,
                      open_to_opportunities, skills)
values
  ('00000000-0000-4000-8000-0000000000f1', 'Grace Achieng',
   'Mathematics & Physics teacher', 'nairobi',
   array['mathematics','physics'], array['cbc','8-4-4']::curriculum[],
   6, true, '445566', false, true, array['Lab safety','Science club patron']),
  ('00000000-0000-4000-8000-0000000000f2', 'Daniel Mutiso',
   'Deputy head, staffing', 'nairobi',
   array['english'], array['cbc']::curriculum[], 12, true, null, false, false, '{}'),
  -- Subjects are not optional in the domain schema (`z.array(Slug).min(1)`),
  -- and a profile that will not parse now stops the app with an explanation
  -- rather than looping to onboarding. The moderator is a teacher too.
  ('00000000-0000-4000-8000-0000000000f3', 'Fixture Moderator',
   'Platform moderator', 'nairobi', array['english'], array['cbc']::curriculum[],
   0, false, null, false, false, '{}'),
  ('00000000-0000-4000-8000-0000000000f4', 'Mary Wambui',
   'Parent in Kilimani', 'nairobi', array['english'], array['cbc']::curriculum[],
   0, false, null, false, false, '{}');

insert into platform_admins (user_id) values ('00000000-0000-4000-8000-0000000000f3');

-- ----------------------------------------------------------------- schools
-- One verified school that posts the job, and one still waiting on
-- verification so the admin queue is not empty.
insert into schools (id, name, slug, county, school_type, curricula, verification,
                     about, student_count, teacher_count, website)
values
  ('00000000-0000-4000-8000-0000000000fa', 'Fixture Valley School', 'fixture-valley-school',
   'nairobi', 'private', array['cbc','8-4-4']::curriculum[], 'verified',
   'A fixture school. Nothing here describes a real institution.', 620, 34, 'fixturevalley.example'),
  ('00000000-0000-4000-8000-0000000000fb', 'Fixture Ridge Academy', 'fixture-ridge-academy',
   'kiambu', 'private', array['cbc']::curriculum[], 'pending',
   'A fixture school awaiting verification.', 410, 22, 'fixtureridge.example');

insert into school_members (school_id, user_id, role) values
  ('00000000-0000-4000-8000-0000000000fa', '00000000-0000-4000-8000-0000000000f2', 'admin');

-- -------------------------------------------------------------------- jobs
insert into jobs (id, school_id, title, subjects, job_type, county, salary_min,
                  salary_max, requirements, published, closes_at, posted_by, poster_kind)
values
  ('00000000-0000-4000-8000-0000000000fc', '00000000-0000-4000-8000-0000000000fa',
   'Mathematics Teacher — Form 3', array['mathematics','physics'], 'full_time', 'nairobi',
   52000, 78000,
   -- JobRequirement needs kind, a string value and a label; `tsc_number` is
   -- not a RequirementKind and a numeric value fails z.string(). Get this
   -- wrong and the vacancy will not parse at all.
   '[{"kind":"tsc_registration","value":"required","label":"TSC registration","mustHave":true},
     {"kind":"subject","value":"mathematics","label":"Teaches mathematics","mustHave":true},
     {"kind":"experience_years","value":"3","label":"At least 3 years teaching","weight":2}]'::jsonb,
   true, now() + interval '12 days', '00000000-0000-4000-8000-0000000000f2', 'school');

insert into applications (id, job_id, teacher_id, stage, match_score, source)
values ('00000000-0000-4000-8000-0000000000fd', '00000000-0000-4000-8000-0000000000fc',
        '00000000-0000-4000-8000-0000000000f1', 'shortlisted', 88, 'manual');

insert into saved_jobs (teacher_id, job_id)
values ('00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-0000000000fc');

-- ------------------------------------------------------- a private request
-- What a parent posts. No school, an area rather than an address, and priced
-- by the hour — the three things that make it different from a vacancy.
insert into jobs (id, school_id, title, subjects, job_type, county, salary_min,
                  salary_max, published, posted_by, poster_kind,
                  engagement, rate_period, area, learner_level, sessions_per_week,
                  meets_online, meets_at_student, meets_at_teacher,
                  level, poster_role, preferred_gender, prefers_locality)
values ('00000000-0000-4000-8000-0000000000ff', null,
        'Maths and physics tutor for Form 2', array['mathematics','physics'],
        'part_time', 'nairobi', 900, 1200, true,
        '00000000-0000-4000-8000-0000000000f4', 'individual',
        'tuition', 'hour', 'Kilimani', 'Form 2', 2,
        true, true, false, 'expert', 'parent', 'female', 'Nairobi');

-- ----------------------------------------------------------------- reviews
-- One review awaiting moderation, about the *other* school, with a red flag —
-- so the moderator queue exercises the part that matters. Invented school,
-- invented complaint.
insert into school_reviews (id, school_id, author_id, role_title, body,
                            employment_verified, moderation)
values ('00000000-0000-4000-8000-0000000000fe', '00000000-0000-4000-8000-0000000000fb',
        '00000000-0000-4000-8000-0000000000f1', 'Teacher of Mathematics',
        'Two good years here. Teaching is well supported and the labs are stocked, '
        'but pay arrived late in three separate terms and nobody would say why.',
        true, 'pending');

insert into review_ratings (review_id, category, score) values
  ('00000000-0000-4000-8000-0000000000fe', 'management', 3),
  ('00000000-0000-4000-8000-0000000000fe', 'pay_reliability', 2),
  ('00000000-0000-4000-8000-0000000000fe', 'workload', 4),
  ('00000000-0000-4000-8000-0000000000fe', 'teacher_treatment', 4),
  ('00000000-0000-4000-8000-0000000000fe', 'resources', 5);

insert into review_red_flags (review_id, kind, reason, occurred_on) values
  ('00000000-0000-4000-8000-0000000000fe', 'salary_delays',
   'Salaries arrived between two and three weeks late in three terms, with no '
   'explanation given to staff who asked about it.',
   '2026-03-15');

commit;

select 'signed-in accounts' as note, email,
       'the fixture.password you set' as password
from auth.users where email like 'alexotieno293+fx%' order by email;
