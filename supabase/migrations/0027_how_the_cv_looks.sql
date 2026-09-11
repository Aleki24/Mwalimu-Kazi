-- How the CV looks, as the teacher's choice rather than the renderer's.
--
-- The templates were four fixed stylesheets. They are now one document with a
-- handful of dials — layout, accent colour, face, size, leading, the two
-- spacings, page margins, a page texture — and a "template" is a named set of
-- starting positions for those dials. That only works if the positions are
-- stored, so here they are.
--
-- Enums rather than free text for the four vocabularies, because
-- `packages/types/src/parity.test.ts` then holds them to the same list the app
-- offers. A template added later is one `alter type ... add value`, which is
-- the price of the test that stops the two drifting.

create type cv_template as enum ('portrait', 'banner', 'bold', 'timeline', 'label', 'classic');
create type cv_accent as enum ('ink', 'indigo', 'teal', 'maroon', 'violet', 'slate', 'terracotta');
create type cv_font as enum (
  'helvetica', 'arial', 'system', 'georgia', 'garamond', 'times', 'trebuchet', 'courier'
);
create type cv_background as enum ('none', 'dots', 'lines');

alter table cv_details
  add column template cv_template not null default 'portrait',
  add column accent cv_accent not null default 'indigo',
  add column font cv_font not null default 'system',
  -- 1–5, not points and millimetres. A teacher is choosing "a bit tighter",
  -- not typesetting, and a bounded scale cannot produce four-point body text
  -- or forty-millimetre margins the way a free number can.
  add column font_scale smallint not null default 3 check (font_scale between 1 and 5),
  add column line_height smallint not null default 3 check (line_height between 1 and 5),
  add column entry_spacing smallint not null default 3 check (entry_spacing between 1 and 5),
  add column section_spacing smallint not null default 3 check (section_spacing between 1 and 5),
  add column page_margins smallint not null default 3 check (page_margins between 1 and 5),
  add column background cv_background not null default 'none';

-- ------------------------------------------------------------------ languages
--
-- A language is a name and, optionally, how well — which the sidebar templates
-- draw as five dots. `cv_details.languages` was a `text[]` with nowhere to put
-- the second half, so it becomes a table like certificates did.
--
-- The level is nullable and stays null unless the teacher says otherwise:
-- several of these templates draw five dots beside a language, and filling
-- them in on their behalf would be the app putting a claim in their mouth.

create table cv_languages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 60),
  level smallint check (level is null or level between 1 and 5),
  created_at timestamptz not null default now()
);

alter table cv_languages enable row level security;

create policy cv_languages_own_all on cv_languages for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Readable by whoever may read the CV, like every other part of it.
create policy cv_languages_readable on cv_languages for select to authenticated
  using (private.may_read_cv(user_id));

create index cv_languages_user_idx on cv_languages (user_id);

-- Carry across whatever the array already held, then drop it. Nothing had a
-- level to lose, because there was nowhere to have put one.
insert into cv_languages (user_id, name)
select d.user_id, btrim(l)
from cv_details d, unnest(d.languages) as l
where btrim(l) <> '';

alter table cv_details drop column languages;
