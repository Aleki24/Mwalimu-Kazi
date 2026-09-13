-- Finding a tutor, without opening up everybody's profile.
--
-- A directory has to show a name, and nothing in `profiles` lets an ordinary
-- parent read one: the only broad policy there is for staff of a verified
-- school. The obvious fix — "a profile is readable if that person is an
-- available tutor" — would also hand over their TSC number, their curricula,
-- whether they are open to opportunities and their notification settings, none
-- of which a parent browsing for a maths tutor asked for or needs.
--
-- So the directory reads through a function that returns exactly the card:
-- name, what they teach, where, how, how much, and whether their TSC number
-- has been checked. `profiles` stays shut.
--
-- SECURITY DEFINER, and therefore: it returns rows only for tutors who have
-- switched themselves on, it refuses anyone not signed in, and it takes no
-- argument that could widen what it returns.

create or replace function public.find_tutors(
  p_tutor uuid default null,
  p_subject text default null,
  p_county text default null,
  p_online boolean default null,
  p_at_student boolean default null,
  p_search text default null,
  p_limit int default 40
)
returns table (
  user_id uuid,
  full_name text,
  headline text,
  about text,
  subjects text[],
  learner_levels text[],
  county text,
  area text,
  meets_online boolean,
  meets_at_student boolean,
  meets_at_teacher boolean,
  rate_min integer,
  rate_max integer,
  rate_period rate_period,
  gender text,
  experience_years integer,
  tsc_verified boolean
)
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select
    t.user_id,
    p.full_name,
    -- The tutor's own words if they wrote any, otherwise the headline they
    -- already have on their teaching profile.
    coalesce(nullif(btrim(t.headline), ''), p.headline),
    t.about,
    t.subjects,
    t.learner_levels,
    coalesce(t.county, p.county),
    t.area,
    t.meets_online,
    t.meets_at_student,
    t.meets_at_teacher,
    t.rate_min,
    t.rate_max,
    t.rate_period,
    t.gender,
    p.experience_years,
    p.tsc_verified
  from tutor_profiles t
  join profiles p on p.id = t.user_id
  where auth.uid() is not null
    and t.available
    and (p_tutor is null or t.user_id = p_tutor)
    and (p_subject is null or p_subject = any (t.subjects))
    and (p_county is null or coalesce(t.county, p.county) = p_county)
    -- Null means "do not mind"; true means "must". Nobody ever wants to filter
    -- for a tutor who cannot teach online.
    and (p_online is not true or t.meets_online)
    and (p_at_student is not true or t.meets_at_student)
    and (
      p_search is null or btrim(p_search) = ''
      or p.full_name ilike '%' || btrim(p_search) || '%'
      or coalesce(t.area, '') ilike '%' || btrim(p_search) || '%'
      or exists (select 1 from unnest(t.subjects) s where s ilike '%' || btrim(p_search) || '%')
    )
  order by p.tsc_verified desc, p.experience_years desc, p.full_name
  limit least(greatest(coalesce(p_limit, 40), 1), 100);
$$;

revoke execute on function public.find_tutors(uuid, text, text, boolean, boolean, text, int) from anon;
