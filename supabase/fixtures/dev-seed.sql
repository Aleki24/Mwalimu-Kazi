-- Fixture content for driving the app in a browser.
--
-- THIS WRITES TO WHATEVER PROJECT YOU RUN IT AGAINST, and this repo has one
-- project. Everything it creates is namespaced — `alexotieno293+fx*` emails and
-- the `fixture-*` slugs — and the first block deletes exactly those, so the
-- file is re-runnable and cannot touch a real account or a real school.
--
-- Written because the same fixtures were hand-rebuilt three times in one
-- session, and a rig you retype is a rig you get subtly wrong.
--
-- THERE IS NO PASSWORD IN HERE, and there is no longer anywhere to put one.
-- This file used to create the four accounts itself, which meant it needed
-- their password, which meant the password had to be handed to whatever ran
-- it — a session variable, a shell history, a paste. It no longer creates
-- accounts at all. Run this first:
--
--   node scripts/seed-fixture-accounts.mjs      # with the root .env sourced
--
-- That signs the four accounts up through the app's own public sign-up
-- endpoint with FIXTURE_PASSWORD from the gitignored .env, so the only place
-- the password exists is that file. This file then looks the accounts up by
-- email and fills in what they own.
--
-- Order matters: accounts first, then this. Running this against a project
-- where the accounts do not exist inserts nothing and says so.

begin;

-- ---------------------------------------------------------------- teardown
-- The accounts themselves are left alone — scripts/seed-fixture-accounts.mjs
-- owns those, and deleting them here would throw away the passwords it just
-- set. Everything they own goes, so re-running this is a clean slate.
delete from schools where slug like 'fixture-%';
delete from profiles where id in (
  select id from auth.users where email like 'alexotieno293+fx%@gmail.com');

-- ------------------------------------------------------------------ people
-- Looked up, not created. An email that is not there yields no row, and every
-- insert below is keyed off this table, so a missing account means a seed that
-- quietly does nothing rather than one that half-populates.
create temp table fx (id uuid, email text, name text, role text) on commit drop;
insert into fx (id, email, name, role)
select u.id, v.email, v.name, v.role
  from (values
    ('alexotieno293+fxteacher@gmail.com',    'Grace Achieng',     'teacher'),
    ('alexotieno293+fxrecruiter@gmail.com',  'Daniel Mutiso',     'recruiter'),
    ('alexotieno293+fxadmin@gmail.com',      'Fixture Moderator', 'admin'),
    -- A parent looking for a tutor. Also a teacher, because in this app they
    -- usually are: nothing gates who may post a request.
    ('alexotieno293+fxparent@gmail.com',     'Mary Wambui',       'parent')
  ) as v(email, name, role)
  join auth.users u on u.email = v.email;

do $$
begin
  if (select count(*) from fx) <> 4 then
    raise exception
      'expected four fixture accounts, found %. Run scripts/seed-fixture-accounts.mjs first.',
      (select count(*) from fx);
  end if;
end $$;

-- A teacher with a TSC number nobody has checked, so the admin queue has one.
insert into profiles (id, full_name, headline, county, subjects, curricula,
                      experience_years, has_degree, tsc_number, tsc_verified,
                      open_to_opportunities, skills)
values
  ((select id from fx where role = 'teacher'), 'Grace Achieng',
   'Mathematics & Physics teacher', 'nairobi',
   array['mathematics','physics'], array['cbc','8-4-4']::curriculum[],
   6, true, '445566', false, true, array['Lab safety','Science club patron']),
  ((select id from fx where role = 'recruiter'), 'Daniel Mutiso',
   'Deputy head, staffing', 'nairobi',
   array['english'], array['cbc']::curriculum[], 12, true, null, false, false, '{}'),
  -- Subjects are not optional in the domain schema (`z.array(Slug).min(1)`),
  -- and a profile that will not parse now stops the app with an explanation
  -- rather than looping to onboarding. The moderator is a teacher too.
  ((select id from fx where role = 'admin'), 'Fixture Moderator',
   'Platform moderator', 'nairobi', array['english'], array['cbc']::curriculum[],
   0, false, null, false, false, '{}'),
  ((select id from fx where role = 'parent'), 'Mary Wambui',
   'Parent in Kilimani', 'nairobi', array['english'], array['cbc']::curriculum[],
   0, false, null, false, false, '{}');

insert into platform_admins (user_id) values ((select id from fx where role = 'admin'));

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
   'A fixture school awaiting verification.', 410, 22, 'fixtureridge.example'),
  -- And one that has never asked, so the "Ask to be verified" path has
  -- somewhere to start. Ridge stays `pending` because the admin queue reads
  -- that, and a fixture set that empties another screen's queue to fill this
  -- one is a fixture set that makes two drives fight.
  ('00000000-0000-4000-8000-0000000000e1', 'Fixture Hill School', 'fixture-hill-school',
   'nairobi', 'private', array['cbc']::curriculum[], 'unverified',
   'A fixture school that has not asked to be checked.', 300, 18, 'fixturehill.example');

insert into school_members (school_id, user_id, role) values
  ('00000000-0000-4000-8000-0000000000fa', (select id from fx where role = 'recruiter'), 'admin'),
  ('00000000-0000-4000-8000-0000000000e1', (select id from fx where role = 'recruiter'), 'admin');

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
   true, now() + interval '12 days', (select id from fx where role = 'recruiter'), 'school');

insert into applications (id, job_id, teacher_id, stage, match_score, source)
values ('00000000-0000-4000-8000-0000000000fd', '00000000-0000-4000-8000-0000000000fc',
        (select id from fx where role = 'teacher'), 'shortlisted', 88, 'manual');

insert into saved_jobs (teacher_id, job_id)
values ((select id from fx where role = 'teacher'), '00000000-0000-4000-8000-0000000000fc');

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
        (select id from fx where role = 'parent'), 'individual',
        'tuition', 'hour', 'Kilimani', 'Form 2', 2,
        true, true, false, 'expert', 'parent', 'female', 'Nairobi');

-- ----------------------------------------------------------------- reviews
-- One review awaiting moderation, about the *other* school, with a red flag —
-- so the moderator queue exercises the part that matters. Invented school,
-- invented complaint.
insert into school_reviews (id, school_id, author_id, role_title, body,
                            employment_verified, moderation)
values ('00000000-0000-4000-8000-0000000000fe', '00000000-0000-4000-8000-0000000000fb',
        (select id from fx where role = 'teacher'), 'Teacher of Mathematics',
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

select 'seeded for' as note, email
from auth.users where email like 'alexotieno293+fx%@gmail.com' order by email;
