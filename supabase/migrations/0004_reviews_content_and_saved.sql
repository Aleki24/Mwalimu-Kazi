-- Tables behind the Schools, Reviews, Resources, News, Notifications and Saved
-- screens.
--
-- Note on function grants: 0003 was a regression caused by granting EXECUTE on
-- a policy helper to `authenticated` only, which broke anonymous reads. Nothing
-- here adds a new helper, and the public-read policies below are deliberately
-- plain predicates so no function permission can gate them.

create type red_flag_kind as enum (
  'salary_delays', 'excessive_workload', 'poor_management', 'contract_issues',
  'harassment', 'unclear_hours', 'poor_communication', 'unsafe_conditions'
);
create type review_category as enum (
  'management', 'pay_reliability', 'workload', 'working_hours', 'teacher_treatment',
  'professional_growth', 'housing', 'student_behaviour', 'resources', 'communication'
);
create type moderation_status as enum ('pending', 'approved', 'rejected');
create type resource_kind as enum (
  'notes', 'scheme_of_work', 'lesson_plan', 'past_paper', 'marking_scheme',
  'worksheet', 'slides', 'assessment'
);
create type news_topic as enum (
  'tsc', 'knec', 'kicd', 'cbc', 'policy', 'recruitment', 'scholarships',
  'professional_development'
);
create type notification_kind as enum (
  'job_match', 'auto_apply_sent', 'auto_apply_failed', 'application_viewed',
  'shortlisted', 'rejected', 'interview_invite', 'profile_viewed',
  'school_review', 'followed_school_job', 'news', 'resource'
);

alter table schools
  add column about         text,
  add column facilities    text[] not null default '{}',
  add column student_count integer check (student_count >= 0),
  add column cover_url     text,
  add column website       text;

create table saved_jobs (
  teacher_id uuid not null references profiles on delete cascade,
  job_id     uuid not null references jobs on delete cascade,
  created_at timestamptz not null default now(),
  primary key (teacher_id, job_id)
);

create table school_reviews (
  id                  uuid primary key default gen_random_uuid(),
  school_id           uuid not null references schools on delete cascade,
  -- Readers never see this. It exists to enforce one review per person per
  -- school and to let an author edit their own; the API must never select it.
  author_id           uuid not null references profiles on delete cascade,
  employment_verified boolean not null default false,
  role_title          text,
  body                text not null check (char_length(body) between 40 and 4000),
  moderation          moderation_status not null default 'pending',
  created_at          timestamptz not null default now(),
  unique (school_id, author_id)
);

create table review_ratings (
  review_id uuid not null references school_reviews on delete cascade,
  category  review_category not null,
  score     smallint not null check (score between 1 and 5),
  primary key (review_id, category)
);

-- A red flag always carries evidence. The 40-character floor mirrors the Zod
-- minimum on RedFlag.reason in packages/types, so neither layer can accept a
-- bare accusation.
create table review_red_flags (
  id          uuid primary key default gen_random_uuid(),
  review_id   uuid not null references school_reviews on delete cascade,
  kind        red_flag_kind not null,
  reason      text not null check (char_length(reason) between 40 and 1000),
  occurred_on date,
  unique (review_id, kind)
);

create index school_reviews_approved_idx on school_reviews (school_id, created_at desc)
  where moderation = 'approved';

create table news_articles (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  source       text not null,
  topic        news_topic not null,
  summary      text,
  body         text,
  url          text,
  image_url    text,
  published_at timestamptz not null default now()
);
create index news_articles_recent_idx on news_articles (published_at desc);

create table resources (
  id             uuid primary key default gen_random_uuid(),
  title          text not null,
  kind           resource_kind not null,
  subject        text,
  file_extension text not null,
  size_bytes     bigint not null check (size_bytes > 0),
  storage_path   text not null,
  download_count integer not null default 0 check (download_count >= 0),
  uploaded_by    uuid references profiles on delete set null,
  created_at     timestamptz not null default now()
);
create index resources_popular_idx on resources (download_count desc);

create table notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles on delete cascade,
  kind       notification_kind not null,
  title      text not null,
  body       text not null,
  payload    jsonb not null default '{}'::jsonb,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_unread_idx on notifications (user_id, created_at desc);

alter table saved_jobs       enable row level security;
alter table school_reviews   enable row level security;
alter table review_ratings   enable row level security;
alter table review_red_flags enable row level security;
alter table news_articles    enable row level security;
alter table resources        enable row level security;
alter table notifications    enable row level security;

create policy saved_jobs_own on saved_jobs
  for all using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());

-- Only APPROVED reviews are readable, by anyone. A pending review is visible to
-- its author alone, so a moderator queue leak cannot expose an unvetted
-- accusation about a named school.
create policy school_reviews_read_approved on school_reviews
  for select using (moderation = 'approved' or author_id = auth.uid());
create policy school_reviews_insert_own on school_reviews
  for insert with check (author_id = auth.uid());
create policy school_reviews_update_own on school_reviews
  for update using (author_id = auth.uid()) with check (author_id = auth.uid());

create policy review_ratings_read on review_ratings
  for select using (
    exists (select 1 from school_reviews r
            where r.id = review_ratings.review_id
              and (r.moderation = 'approved' or r.author_id = auth.uid()))
  );
create policy review_ratings_write_own on review_ratings
  for all using (
    exists (select 1 from school_reviews r where r.id = review_ratings.review_id and r.author_id = auth.uid())
  ) with check (
    exists (select 1 from school_reviews r where r.id = review_ratings.review_id and r.author_id = auth.uid())
  );

create policy review_red_flags_read on review_red_flags
  for select using (
    exists (select 1 from school_reviews r
            where r.id = review_red_flags.review_id
              and (r.moderation = 'approved' or r.author_id = auth.uid()))
  );
create policy review_red_flags_write_own on review_red_flags
  for all using (
    exists (select 1 from school_reviews r where r.id = review_red_flags.review_id and r.author_id = auth.uid())
  ) with check (
    exists (select 1 from school_reviews r where r.id = review_red_flags.review_id and r.author_id = auth.uid())
  );

create policy news_articles_read on news_articles for select using (true);
create policy resources_read on resources for select using (true);

create policy notifications_own on notifications
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Signed-out visitors get the browsing surface and nothing else.
revoke select on table saved_jobs, notifications from anon;
