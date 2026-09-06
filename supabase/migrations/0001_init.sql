-- Mwalimu Kazi — initial schema for the Jobs + Match Score slice.
--
-- Access rules live in RLS policies rather than in application code: a teacher's
-- documents, their Auto-Apply rules and their application history are private by
-- default, and no client bug or forgotten `.eq('user_id', me)` can widen that.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- vocabularies
-- These mirror packages/types/src/enums.ts. Change both together.
create type curriculum       as enum ('cbc', '8-4-4', 'igcse', 'ib', 'montessori');
create type job_type         as enum ('full_time', 'part_time', 'contract', 'locum');
create type school_type      as enum ('private', 'international', 'public');
create type application_stage as enum
  ('saved', 'applied', 'viewed', 'shortlisted', 'interview', 'offered', 'rejected', 'withdrawn');
create type application_source as enum ('manual', 'auto_apply');
create type verification_status as enum ('unverified', 'pending', 'verified', 'under_review');
create type school_role       as enum ('recruiter', 'admin');

-- ---------------------------------------------------------------------- people
create table profiles (
  id                     uuid primary key references auth.users on delete cascade,
  full_name              text not null check (char_length(full_name) between 2 and 120),
  headline               text check (char_length(headline) <= 160),
  county                 text not null,
  subjects               text[] not null default '{}',
  curricula              curriculum[] not null default '{}',
  experience_years       smallint not null default 0 check (experience_years between 0 and 60),
  has_degree             boolean not null default false,
  -- The TSC number is a real-world identifier: verified separately, never
  -- trusted from client input alone.
  tsc_number             text check (tsc_number ~ '^\d{4,9}$'),
  tsc_verified           boolean not null default false,
  open_to_opportunities  boolean not null default true,
  skills                 text[] not null default '{}',
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

-- --------------------------------------------------------------------- schools
create table schools (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  slug          text not null unique check (slug ~ '^[a-z0-9-]+$'),
  county        text not null,
  school_type   school_type not null,
  curricula     curriculum[] not null default '{}',
  -- Verification gates who may post jobs; unverified schools are visible but
  -- cannot reach teachers, which is the defence against fake vacancies.
  verification  verification_status not null default 'unverified',
  teacher_count integer check (teacher_count >= 0),
  created_at    timestamptz not null default now()
);

create table school_members (
  school_id uuid not null references schools on delete cascade,
  user_id   uuid not null references auth.users on delete cascade,
  role      school_role not null default 'recruiter',
  primary key (school_id, user_id)
);

-- ------------------------------------------------------------------------ jobs
create table jobs (
  id           uuid primary key default gen_random_uuid(),
  school_id    uuid not null references schools on delete cascade,
  title        text not null check (char_length(title) between 3 and 160),
  subjects     text[] not null check (cardinality(subjects) > 0),
  job_type     job_type not null,
  county       text not null,
  salary_min   integer check (salary_min >= 0),
  salary_max   integer check (salary_max >= 0),
  -- Requirements are the input to match scoring; shape is validated by
  -- JobRequirement in packages/types before insert.
  requirements jsonb not null default '[]'::jsonb,
  published    boolean not null default false,
  posted_at    timestamptz not null default now(),
  closes_at    timestamptz,
  created_at   timestamptz not null default now(),
  constraint salary_band_ordered check (salary_max is null or salary_min is null or salary_max >= salary_min)
);

create index jobs_open_idx on jobs (published, posted_at desc) where published;
create index jobs_county_idx on jobs (county) where published;
create index jobs_subjects_idx on jobs using gin (subjects);

-- ---------------------------------------------------------------- applications
create table applications (
  id          uuid primary key default gen_random_uuid(),
  job_id      uuid not null references jobs on delete cascade,
  teacher_id  uuid not null references profiles on delete cascade,
  stage       application_stage not null default 'applied',
  source      application_source not null default 'manual',
  -- Scored at submission time and frozen: the teacher's profile keeps changing,
  -- but the school must see the match as it stood when they received it.
  match_score smallint not null check (match_score between 0 and 100),
  created_at  timestamptz not null default now(),
  -- One application per teacher per job; this is also what Auto-Apply's
  -- already-applied gate relies on.
  unique (job_id, teacher_id)
);

-- ------------------------------------------------------------------ auto-apply
create table auto_apply_rules (
  teacher_id                  uuid primary key references profiles on delete cascade,
  enabled                     boolean not null default false,
  subjects                    text[] not null default '{}',
  counties                    text[] not null default '{}',
  min_salary                  integer check (min_salary >= 0),
  min_match_score             smallint not null default 85 check (min_match_score between 50 and 100),
  job_types                   job_type[] not null default '{}',
  excluded_school_ids         uuid[] not null default '{}',
  daily_limit                 smallint not null default 5  check (daily_limit between 1 and 20),
  weekly_limit                smallint not null default 20 check (weekly_limit between 1 and 100),
  require_review_before_sending boolean not null default false,
  updated_at                  timestamptz not null default now()
);

-- Every Auto-Apply decision is recorded, including the skips. A teacher must be
-- able to answer "why didn't you apply to that one?" without guessing.
create table auto_apply_events (
  id          uuid primary key default gen_random_uuid(),
  teacher_id  uuid not null references profiles on delete cascade,
  job_id      uuid not null references jobs on delete cascade,
  outcome     text not null check (outcome in ('applied', 'held', 'skipped', 'failed')),
  reason      text,
  match_score smallint check (match_score between 0 and 100),
  created_at  timestamptz not null default now()
);

create index auto_apply_events_recent_idx on auto_apply_events (teacher_id, created_at desc);

-- ------------------------------------------------------------------------- RLS
alter table profiles          enable row level security;
alter table schools           enable row level security;
alter table school_members    enable row level security;
alter table jobs              enable row level security;
alter table applications      enable row level security;
alter table auto_apply_rules  enable row level security;
alter table auto_apply_events enable row level security;

-- Membership lookup used by several policies. SECURITY DEFINER so the policy can
-- read school_members without recursing through that table's own RLS.
-- NOTE: migration 0002 moves this into the `private` schema so PostgREST stops
-- exposing it as an RPC endpoint. Read 0002 before changing it here.
create or replace function is_school_member(target_school uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from school_members m
    where m.school_id = target_school and m.user_id = auth.uid()
  );
$$;

-- Profiles: yours is always yours. Others see it only if you opted in to being
-- discoverable, and only if they actually recruit for a verified school.
create policy profiles_select_own on profiles
  for select using (id = auth.uid());
create policy profiles_select_discoverable on profiles
  for select using (
    open_to_opportunities
    and exists (
      select 1 from school_members m
      join schools s on s.id = m.school_id
      where m.user_id = auth.uid() and s.verification = 'verified'
    )
  );
create policy profiles_write_own on profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

-- Schools and published jobs are the public surface of the product.
create policy schools_select_all on schools for select using (true);
create policy schools_update_admin on schools
  for update using (
    exists (select 1 from school_members m
            where m.school_id = schools.id and m.user_id = auth.uid() and m.role = 'admin')
  );

create policy school_members_select_own on school_members
  for select using (user_id = auth.uid() or is_school_member(school_id));

create policy jobs_select_published on jobs
  for select using (published or is_school_member(school_id));
create policy jobs_write_members on jobs
  for all using (is_school_member(school_id)) with check (is_school_member(school_id));

-- Applications: the teacher who sent it, and the school that received it.
create policy applications_select_teacher on applications
  for select using (teacher_id = auth.uid());
create policy applications_select_school on applications
  for select using (
    exists (select 1 from jobs j where j.id = applications.job_id and is_school_member(j.school_id))
  );
create policy applications_insert_teacher on applications
  for insert with check (teacher_id = auth.uid());
-- Only the receiving school moves an application through the pipeline.
create policy applications_update_school on applications
  for update using (
    exists (select 1 from jobs j where j.id = applications.job_id and is_school_member(j.school_id))
  );

-- Auto-Apply is strictly private: no school ever sees a teacher's rules or the
-- roles they were skipped for.
create policy auto_apply_rules_own on auto_apply_rules
  for all using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());
create policy auto_apply_events_own on auto_apply_events
  for select using (teacher_id = auth.uid());
