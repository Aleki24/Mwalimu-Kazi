-- The recruiter side: becoming a school, and seeing who applied.
--
-- Until now `schools` and `school_members` had no INSERT policy at all, so
-- there was no way for anyone to become a recruiter. Applications landed in a
-- table nobody could read.

-- ----------------------------------------------------------- creating a school
--
-- SECURITY DEFINER, and it is the reason there is still no plain INSERT policy
-- on either table. A policy permissive enough to let someone create a school
-- would also let them insert a school they are not a member of, or add
-- themselves to somebody else's. This function is the only way in, and it
-- enforces the invariant that matters: a school always exists with exactly one
-- creator, recorded as its admin, in one transaction.
--
-- `verification` is NOT a parameter. A school that could declare itself
-- verified would make the badge meaningless, and the badge is what teachers
-- read before trusting a vacancy.
create function public.create_school(
  p_name        text,
  p_county      text,
  p_school_type school_type,
  p_curricula   curriculum[] default '{}'
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  -- v_ prefixes are not decoration: a local named `slug` is ambiguous against
  -- schools.slug inside the INSERT, and Postgres rejects the function at call
  -- time with "column reference slug is ambiguous".
  v_id   uuid;
  v_base text;
  v_slug text;
  v_n    int := 0;
begin
  if auth.uid() is null then
    raise exception 'sign in first' using errcode = 'insufficient_privilege';
  end if;
  if char_length(btrim(p_name)) < 2 then
    raise exception 'a school needs a name' using errcode = 'check_violation';
  end if;

  -- Slug from the name, uniquified by counting up. Generated here rather than
  -- taken from the client so two schools cannot fight over one URL.
  v_base := regexp_replace(lower(btrim(p_name)), '[^a-z0-9]+', '-', 'g');
  v_base := btrim(v_base, '-');
  if v_base = '' then v_base := 'school'; end if;
  v_slug := v_base;
  while exists (select 1 from schools s where s.slug = v_slug) loop
    v_n := v_n + 1;
    v_slug := v_base || '-' || v_n;
  end loop;

  insert into schools (name, slug, county, school_type, curricula)
  values (btrim(p_name), v_slug, p_county, p_school_type, p_curricula)
  returning id into v_id;

  insert into school_members (school_id, user_id, role)
  values (v_id, auth.uid(), 'admin');

  return v_id;
end;
$$;

revoke all on function public.create_school(text, text, school_type, curriculum[]) from public;
grant execute on function public.create_school(text, text, school_type, curriculum[]) to authenticated;

-- ------------------------------------------------------ seeing your applicants
--
-- Applying to a job is consent to be seen by that school, and nothing else.
-- This is deliberately narrower than profiles_select_discoverable, which lets
-- a VERIFIED school browse teachers who never contacted them — that one stays
-- gated on verification precisely because it is unsolicited.
--
-- A teacher who applies has chosen this school. So an unverified school can
-- read the profile of someone who applied to its own vacancy, and no one
-- else's. It still cannot browse.
create policy profiles_select_applicant on profiles
  for select using (
    exists (
      select 1
      from applications a
      join jobs j on j.id = a.job_id
      where a.teacher_id = profiles.id
        and j.school_id is not null
        and private.is_school_member(j.school_id)
    )
  );
