-- The rest of what a Kenyan CV actually has on it.
--
-- The CV tables carried a summary, three contact fields, education, experience
-- and referees. Every CV a teacher in Kenya sends also carries a photograph,
-- date of birth, gender and nationality in a panel down the side, along with
-- the lists that make up the rest of a person: languages, skills, hobbies,
-- positions of responsibility, short courses, and unpaid work.
--
-- Flat lists are arrays rather than four more tables. They are ordered strings
-- with no other attributes and nothing references them; a table each would be
-- four migrations, four policies, four fetches and four editors for no gain a
-- teacher would notice. The bounds below are what stops "a list" becoming an
-- upload channel.
--
-- Volunteer work is not an array: it has a role, an organisation and years, so
-- it is experience, and modelling it twice would mean formatting it twice.

alter table cv_details
  -- The path inside the private `cv-photos` bucket, never a URL. A URL would
  -- be a bearer token in a row anyone who could read the row could replay.
  add column photo_path text,
  add column date_of_birth date
    check (date_of_birth is null
           or (date_of_birth > '1930-01-01' and date_of_birth < current_date)),
  -- Free text, not an enum. A CV is a document a person writes about
  -- themselves, and the app has no business enumerating who they may be.
  add column gender text check (gender is null or char_length(btrim(gender)) between 1 and 40),
  add column nationality text check (nationality is null or char_length(btrim(nationality)) between 2 and 60),
  -- A postal address, because Kenyan employers still ask for one. Only ever
  -- printed on the document the teacher exports themselves — nothing reads
  -- `cv_details` but its owner.
  add column address text check (address is null or char_length(btrim(address)) <= 200),
  -- The city is the existing `location` column, which already holds one and
  -- already fills the header of the other templates. A second city field
  -- would be two answers to the same question, and the one the document used
  -- would be a coin toss.
  add column post_code text check (post_code is null or char_length(btrim(post_code)) between 2 and 20),
  add column languages text[] not null default '{}',
  add column hobbies text[] not null default '{}',
  add column responsibilities text[] not null default '{}',
  add column certificates text[] not null default '{}';

-- One shape for all four: at most 20 entries, each 1–300 characters, none
-- blank. Written as a single immutable helper so the four constraints cannot
-- drift apart, and so a fifth list gets the same bounds for free.
create or replace function private.is_short_list(items text[], max_items int default 20)
returns boolean
language sql
immutable
as $$
  select cardinality(items) <= max_items
     and not exists (
       select 1 from unnest(items) as item
       where btrim(item) = '' or char_length(item) > 300
     );
$$;

alter table cv_details
  add constraint cv_details_languages_sane check (private.is_short_list(languages)),
  add constraint cv_details_hobbies_sane check (private.is_short_list(hobbies)),
  add constraint cv_details_responsibilities_sane check (private.is_short_list(responsibilities)),
  add constraint cv_details_certificates_sane check (private.is_short_list(certificates));

-- Unpaid work, printed under its own heading rather than mixed into the
-- career. A boolean and not an enum: there is no third kind, and an enum would
-- be one more pair of declarations to keep in step.
alter table cv_experience add column is_volunteer boolean not null default false;

-- ------------------------------------------------------------------- photos
--
-- Private, and owner-scoped by the first path segment. The app uploads to
-- `<user id>/portrait.jpg`, so the policy is the same shape as every other
-- per-user rule in this schema: you may touch your own folder and no other.
-- Public would be simpler and would also mean every teacher's face was on a
-- guessable URL for anyone who wanted to scrape them.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cv-photos', 'cv-photos', false, 3145728,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists cv_photos_own_read on storage.objects;
create policy cv_photos_own_read on storage.objects for select to authenticated
  using (bucket_id = 'cv-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists cv_photos_own_write on storage.objects;
create policy cv_photos_own_write on storage.objects for insert to authenticated
  with check (bucket_id = 'cv-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists cv_photos_own_update on storage.objects;
create policy cv_photos_own_update on storage.objects for update to authenticated
  using (bucket_id = 'cv-photos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'cv-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists cv_photos_own_delete on storage.objects;
create policy cv_photos_own_delete on storage.objects for delete to authenticated
  using (bucket_id = 'cv-photos' and (storage.foldername(name))[1] = auth.uid()::text);
