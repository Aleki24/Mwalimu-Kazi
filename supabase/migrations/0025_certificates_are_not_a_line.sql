-- A short course is a thing with a name and a date, not a sentence.
--
-- 0024 put certificates in a `text[]` alongside skills, languages and hobbies,
-- which are genuinely flat lists. Certificates are not: they have a title, the
-- year you sat them, and a line saying where. Storing that as one string means
-- the teacher formats their own CV inside a text box, and the document cannot
-- lay a title out differently from its detail.
--
-- The array is dropped rather than kept in parallel. It shipped in the same
-- unpushed batch as this and nothing has ever written to it.

alter table cv_details drop column certificates;

create table cv_certificates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 2 and 160),
  -- Where and with whom. Optional, because "Certificate in computer packages"
  -- is already a useful line on its own.
  description text check (description is null or char_length(btrim(description)) <= 400),
  year smallint check (year is null or year between 1950 and 2100),
  -- The "Present" toggle in the editor: a course still being taken.
  is_ongoing boolean not null default false,
  created_at timestamptz not null default now(),
  -- A year and "still doing it" contradict each other, and a CV that claims
  -- both is a CV a reader stops trusting.
  constraint cv_certificates_not_both check (not (is_ongoing and year is not null))
);

alter table cv_certificates enable row level security;

create policy cv_certificates_own_all on cv_certificates for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create index cv_certificates_user_idx on cv_certificates (user_id);
