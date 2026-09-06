-- The CV a teacher builds once and keeps updating.
--
-- Structured tables rather than a JSONB blob. A CV is exported into several
-- templates, and a template needs to lay out education differently from
-- experience — which means the renderer has to know what each entry IS. A blob
-- would push that knowledge into the renderer as guesswork, and would let a
-- half-written entry persist in a shape nothing could read.
--
-- There is no `sort_order` column anywhere. A CV is conventionally reverse
-- chronological, so ordering is derived from the dates the teacher already
-- entered. A manual ordering field would be a second source of truth for
-- something the data already says, and someone would eventually drag an entry
-- into an order its dates contradict.

create table cv_details (
  user_id     uuid primary key references profiles on delete cascade,
  -- The paragraph at the top. Capped low on purpose: a personal statement that
  -- runs past a short paragraph stops being read.
  summary     text check (summary is null or char_length(btrim(summary)) between 1 and 1200),
  email       text check (email is null or char_length(btrim(email)) between 3 and 200),
  phone       text check (phone is null or char_length(btrim(phone)) between 3 and 40),
  location    text check (location is null or char_length(btrim(location)) between 1 and 120),
  updated_at  timestamptz not null default now()
);

create table cv_education (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references profiles on delete cascade,
  institution   text not null check (char_length(btrim(institution)) between 1 and 200),
  qualification text not null check (char_length(btrim(qualification)) between 1 and 200),
  -- Years, not dates. Nobody remembers the day they started Form 1, and asking
  -- for one is how a form gets abandoned.
  start_year    smallint check (start_year between 1950 and 2100),
  end_year      smallint check (end_year between 1950 and 2100),
  grade         text check (grade is null or char_length(btrim(grade)) between 1 and 60),
  created_at    timestamptz not null default now(),
  check (start_year is null or end_year is null or end_year >= start_year)
);
create index cv_education_owner_idx on cv_education (user_id, end_year desc nulls first);

create table cv_experience (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references profiles on delete cascade,
  organisation text not null check (char_length(btrim(organisation)) between 1 and 200),
  role         text not null check (char_length(btrim(role)) between 1 and 200),
  start_year   smallint check (start_year between 1950 and 2100),
  end_year     smallint check (end_year between 1950 and 2100),
  is_current   boolean not null default false,
  description  text check (description is null or char_length(btrim(description)) between 1 and 2000),
  created_at   timestamptz not null default now(),
  -- A current role has no end year. Allowing both would put "2019 – 2022 ·
  -- Present" on a CV, which is the kind of thing that loses an interview.
  check (not (is_current and end_year is not null)),
  check (start_year is null or end_year is null or end_year >= start_year)
);
create index cv_experience_owner_idx on cv_experience (user_id, is_current desc, end_year desc nulls first);

create table cv_referees (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references profiles on delete cascade,
  name         text not null check (char_length(btrim(name)) between 1 and 160),
  title        text check (title is null or char_length(btrim(title)) between 1 and 160),
  organisation text check (organisation is null or char_length(btrim(organisation)) between 1 and 200),
  phone        text check (phone is null or char_length(btrim(phone)) between 3 and 40),
  email        text check (email is null or char_length(btrim(email)) between 3 and 200),
  created_at   timestamptz not null default now()
);
create index cv_referees_owner_idx on cv_referees (user_id, created_at);

alter table cv_details    enable row level security;
alter table cv_education  enable row level security;
alter table cv_experience enable row level security;
alter table cv_referees   enable row level security;

-- Owner-only, all four, with no exception for recruiters.
--
-- A CV holds a home location, a personal phone number, and — in the referees
-- table — the contact details of third parties who never signed up here and
-- cannot consent on this teacher's behalf. None of that is browsable. A CV
-- reaches a school when the teacher exports it and sends it, which is a
-- deliberate act, not a query.
create policy cv_details_own on cv_details
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy cv_education_own on cv_education
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy cv_experience_own on cv_experience
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy cv_referees_own on cv_referees
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
