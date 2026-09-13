-- Teachers who want to be found.
--
-- The tuition half of this app only worked in one direction: a parent posted a
-- request and waited, and a teacher could answer one but could not be looked
-- up. So a parent with a Form 2 who needs maths on Tuesdays had nothing to
-- browse, and a teacher who tutors for a living was invisible until somebody
-- else happened to post the right thing. That is half a marketplace.
--
-- This is the other half: a profile a teacher opts into, saying what they
-- teach, to whom, where, how, and for how much.
--
-- Opt-in and nothing else. A teaching profile already exists for everybody who
-- signed up, and quietly listing all of them as available for private tuition
-- would be publishing a service on their behalf that they never offered.

create table tutor_profiles (
  user_id uuid primary key references profiles(id) on delete cascade,

  -- The switch. Off means the row is invisible to everyone but its owner, so
  -- a teacher can fill it in, look at it, and think about it.
  available boolean not null default false,

  headline text check (headline is null or char_length(btrim(headline)) between 4 and 90),
  about text check (about is null or char_length(btrim(about)) between 20 and 1200),

  -- What they will teach privately, which is often a subset of what they teach
  -- for a living — plenty of physics teachers will only tutor maths.
  subjects text[] not null default '{}' check (cardinality(subjects) between 0 and 12),
  -- Who they will teach: "Grade 4-8", "Form 1-4", "Adult beginners". Free text
  -- for the same reason `jobs.learner_level` is: Kenyan schooling is mid-
  -- reform and an enum written today is wrong by next year.
  learner_levels text[] not null default '{}' check (cardinality(learner_levels) between 0 and 8),

  county text,
  -- A ward or estate, never an address — the same rule the requests follow.
  -- There is no address column here either, so there is nothing to leak.
  area text check (area is null or char_length(btrim(area)) between 2 and 80),

  -- The same three questions a request asks, so a tutor and a request can be
  -- compared on the one thing that decides whether either is possible.
  meets_online boolean not null default true,
  meets_at_student boolean not null default false,
  meets_at_teacher boolean not null default false,

  rate_min integer check (rate_min is null or rate_min >= 0),
  rate_max integer check (rate_max is null or rate_max >= 0),
  rate_period rate_period not null default 'hour',

  -- Published only if the teacher types it. Requests may state a preference —
  -- a household choosing who comes into their home — and a tutor answering
  -- that is a choice they make, not a fact the app reads off their CV.
  gender text check (gender is null or char_length(btrim(gender)) between 1 and 40),

  updated_at timestamptz not null default now(),

  constraint tutor_rate_ordered check (rate_max is null or rate_min is null or rate_max >= rate_min),
  -- Available and unreachable is not an offer.
  constraint tutor_is_reachable check (
    not available or (meets_online or meets_at_student or meets_at_teacher)
  ),
  -- Available with nothing to teach is not an offer either.
  constraint tutor_teaches_something check (not available or cardinality(subjects) > 0)
);

alter table tutor_profiles enable row level security;

create policy tutor_profiles_own on tutor_profiles for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Anybody signed in may read a tutor who has switched themselves on. This is
-- a directory: being findable is the entire point of the row existing.
create policy tutor_profiles_available on tutor_profiles for select to authenticated
  using (available);

create index tutor_profiles_available_idx on tutor_profiles (available, county);
