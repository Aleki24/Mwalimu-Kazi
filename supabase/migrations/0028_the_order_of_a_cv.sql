-- The order of a CV, and what its sections are called.
--
-- Every CV here put Profile, then Education, then Employment, in that order,
-- with those words. That is a reasonable default and a bad rule: a teacher
-- fresh out of university leads with Education, one with fifteen years leads
-- with Employment, and plenty of Kenyan schools ask for "Work Experience"
-- rather than "Employment" by name.
--
-- One row per section per teacher. `position` orders them; `title` overrides
-- the default word, or is null to keep it. A section with no row at all is
-- simply one nobody has moved or renamed, which is why the default order lives
-- in `packages/core` and not as thirteen rows inserted on sign-up.

create type cv_section as enum (
  'personal', 'profile', 'education', 'employment', 'skills', 'languages',
  'hobbies', 'volunteer', 'responsibilities', 'certificates', 'subjects', 'referees'
);

create table cv_sections (
  user_id uuid not null references profiles(id) on delete cascade,
  section cv_section not null,
  position smallint not null check (position between 0 and 99),
  -- Null means "call it whatever the template calls it". An empty string is
  -- not a rename, it is a section with no heading, and that is a mistake
  -- rather than a choice.
  title text check (title is null or char_length(btrim(title)) between 2 and 40),
  primary key (user_id, section)
);

alter table cv_sections enable row level security;

create policy cv_sections_own_all on cv_sections for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Readable by whoever may read the CV: the order and the headings are part of
-- the document, not decoration on top of it.
create policy cv_sections_readable on cv_sections for select to authenticated
  using (private.may_read_cv(user_id));
