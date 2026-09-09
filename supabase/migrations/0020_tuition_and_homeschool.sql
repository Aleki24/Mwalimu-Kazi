-- Homeschool and private tuition, as a request a parent posts.
--
-- Modelled as jobs rather than a table of their own, because everything a
-- request needs already hangs off jobs: the matcher scores against them,
-- applications are how a teacher answers one, and a message thread is anchored
-- to an application. A separate table would have meant a second matcher and a
-- second chat.
--
-- What a private request is NOT allowed to carry is an address. There is no
-- column for one here on purpose: the listing says which area, and where
-- exactly is something the parent tells the teacher in the thread once they
-- have agreed. A field that exists is a field that leaks, and this one would
-- publish an invitation to a home with a child in it.

create type engagement_kind as enum ('employment', 'tuition', 'homeschool');

-- Existing rows are all school and individual employment, so the default is
-- what they already are and no backfill is needed.
alter table jobs add column engagement engagement_kind not null default 'employment';

-- Pay was read as monthly everywhere, including by formatSalaryFull, which
-- hardcoded "per month". Tuition is priced by the hour or the session.
create type rate_period as enum ('month', 'hour', 'session');
alter table jobs add column rate_period rate_period not null default 'month';

-- How the teaching happens, and roughly where. `area` is a ward or estate —
-- "Kilimani", "Nyali" — never a street address.
create type teaching_mode as enum ('in_person', 'online', 'either');
alter table jobs
  add column delivery teaching_mode,
  add column area text check (area is null or char_length(btrim(area)) between 2 and 80),
  add column learner_level text check (learner_level is null or char_length(btrim(learner_level)) between 1 and 60),
  add column sessions_per_week smallint check (sessions_per_week is null or sessions_per_week between 1 and 14);

-- A private request without an area or a mode is not answerable: a teacher
-- cannot tell whether they can physically get there. Employment listings are
-- unaffected, since a school has a page with its own location.
alter table jobs add constraint jobs_private_request_is_answerable check (
  engagement = 'employment'
  or (delivery is not null and area is not null and btrim(area) <> '')
);

-- A homeschool or tuition request is by definition not a school vacancy, and
-- the poster_kind trigger from 0008 already derives 'individual' from a null
-- school_id. This makes the other direction impossible: a request cannot be
-- filed under a school and inherit its verified badge.
alter table jobs add constraint jobs_private_request_has_no_school check (
  engagement = 'employment' or school_id is null
);

create index jobs_engagement_idx on jobs (engagement, posted_at desc) where published;
