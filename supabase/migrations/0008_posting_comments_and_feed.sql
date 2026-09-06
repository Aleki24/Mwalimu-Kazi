-- Opens job posting beyond schools, adds comments, the teacher feed, and a
-- sound-notification preference.

-- ------------------------------------------------------------ who may post
--
-- Until now a job belonged to a school and only its members could write one.
-- Individuals and platform staff can post now too, which means a listing can
-- exist with no verified institution behind it — exactly the shape a scam
-- listing takes ("pay a 2,000/= registration fee for this teaching post").
-- So provenance becomes a column rather than something inferred, and the app
-- shows it. It is set by a trigger, never by the client.
create type job_poster_kind as enum ('school', 'individual', 'platform');

-- Platform staff. Deliberately its own table rather than a boolean on
-- profiles: a profile row is writable by its owner, and a self-grantable admin
-- flag is not an admin flag.
create table platform_admins (
  user_id uuid primary key references profiles on delete cascade,
  granted_at timestamptz not null default now()
);
alter table platform_admins enable row level security;
-- No policy at all: unreachable through PostgREST by any client. Membership is
-- granted out of band and read only by the SECURITY DEFINER helper below.

create or replace function private.is_platform_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from platform_admins a where a.user_id = auth.uid());
$$;
grant execute on function private.is_platform_admin() to anon, authenticated;

alter table jobs
  alter column school_id drop not null,
  add column posted_by uuid references profiles on delete set null,
  add column poster_kind job_poster_kind not null default 'school';

-- A job with neither a school nor a poster is unattributable, and an
-- unattributable job advert is the thing we are trying not to host.
alter table jobs add constraint jobs_attributable
  check (school_id is not null or posted_by is not null);

create or replace function private.set_job_provenance()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  -- posted_by is always the authenticated writer. Never taken from the client:
  -- a listing that can name someone else as its author is a forgery tool.
  if auth.uid() is not null then
    new.posted_by := auth.uid();
  end if;

  new.poster_kind := case
    when new.school_id is not null then 'school'
    when private.is_platform_admin() then 'platform'
    else 'individual'
  end;
  return new;
end;
$$;

create trigger jobs_set_provenance
  before insert or update of school_id on jobs
  for each row execute function private.set_job_provenance();

drop policy jobs_write_members on jobs;
drop policy jobs_select_published on jobs;

create policy jobs_select_visible on jobs
  for select using (
    published
    or (school_id is not null and private.is_school_member(school_id))
    or posted_by = auth.uid()
    or private.is_platform_admin()
  );

-- Writing a school's job still requires membership; that has not loosened.
-- What is new is that a signed-in teacher may post a job of their own.
create policy jobs_write_school on jobs
  for all using (school_id is not null and private.is_school_member(school_id))
  with check (school_id is not null and private.is_school_member(school_id));

create policy jobs_write_own on jobs
  for all using (posted_by = auth.uid() and school_id is null)
  with check (auth.uid() is not null and school_id is null);

create policy jobs_write_platform on jobs
  for all using (private.is_platform_admin()) with check (private.is_platform_admin());

-- ------------------------------------------------------------- job comments
create table job_comments (
  id         uuid primary key default gen_random_uuid(),
  job_id     uuid not null references jobs on delete cascade,
  author_id  uuid not null references profiles on delete cascade,
  body       text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index job_comments_job_idx on job_comments (job_id, created_at desc);
alter table job_comments enable row level security;

-- Comments are attributed, unlike reviews. A question about a vacancy is a
-- normal public act; an account of a bad employer is not, and the two must not
-- share a model.
create policy job_comments_read on job_comments
  for select using (exists (select 1 from jobs j where j.id = job_id and j.published));
create policy job_comments_insert_own on job_comments
  for insert with check (author_id = auth.uid());
create policy job_comments_update_own on job_comments
  for update using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy job_comments_delete_own on job_comments
  for delete using (author_id = auth.uid() or private.is_platform_admin());

-- --------------------------------------------------------------- the feed
create table posts (
  id         uuid primary key default gen_random_uuid(),
  author_id  uuid not null references profiles on delete cascade,
  body       text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index posts_recent_idx on posts (created_at desc);
alter table posts enable row level security;

create policy posts_read_all on posts for select using (true);
create policy posts_insert_own on posts for insert with check (author_id = auth.uid());
create policy posts_update_own on posts
  for update using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy posts_delete_own on posts
  for delete using (author_id = auth.uid() or private.is_platform_admin());

create table post_comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references posts on delete cascade,
  author_id  uuid not null references profiles on delete cascade,
  body       text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index post_comments_post_idx on post_comments (post_id, created_at desc);
alter table post_comments enable row level security;

create policy post_comments_read_all on post_comments for select using (true);
create policy post_comments_insert_own on post_comments for insert with check (author_id = auth.uid());
create policy post_comments_update_own on post_comments
  for update using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy post_comments_delete_own on post_comments
  for delete using (author_id = auth.uid() or private.is_platform_admin());

-- A like is its own row so the count cannot drift from who liked it, and so
-- one person cannot like twice.
create table post_likes (
  post_id    uuid not null references posts on delete cascade,
  user_id    uuid not null references profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
alter table post_likes enable row level security;

create policy post_likes_read_all on post_likes for select using (true);
create policy post_likes_write_own on post_likes
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ------------------------------------------------------- notification sound
-- "When enabled" — off by default. A job app that makes noise without being
-- asked gets muted at the OS level, and then none of its alerts land.
alter table profiles add column notification_sound boolean not null default false;
