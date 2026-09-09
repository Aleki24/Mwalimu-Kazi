-- Every trust signal in the app was self-issued.
--
-- Proven against the live project as an ordinary signed-in user, in one
-- transaction: they approved their own pending review, set tsc_verified on
-- themselves, and marked their own school verified. Three policies, each
-- reasonable alone, each one column too wide:
--
--   school_reviews_update_own  for update using (author_id = auth.uid())
--   profiles_write_own         for all    using (id = auth.uid())
--   schools_update_admin       for update using (<is a school admin>)
--
-- The author does need to edit their review, the teacher their profile, the
-- school its own page. What none of them may touch is the column that says
-- somebody else checked. So the fix is not a narrower policy — it is a guard
-- on those three columns specifically.
--
-- A trigger rather than column privileges: revoking UPDATE(col) does nothing
-- while the role still holds table-level UPDATE, so the real column-privilege
-- version means enumerating every *other* column and re-granting them, which
-- silently reopens the hole the next time a column is added. A trigger names
-- the rule, survives new columns, and can say why it refused.

create or replace function private.guard_trust_flags()
returns trigger language plpgsql security invoker set search_path = public, pg_temp as $$
begin
  -- auth.uid() is null for the service role and for direct SQL, which is how
  -- the platform itself administers these values. anon never reaches here:
  -- it has no UPDATE on profiles and fails the schools and reviews policies.
  if auth.uid() is null or private.is_platform_admin() then
    return new;
  end if;

  -- Nested rather than `tg_table_name = 'x' and new.col is distinct ...`:
  -- PL/pgSQL hands the whole boolean to SQL as one expression, so the field
  -- reference is resolved even when the table test is false, and the guard
  -- died with `record "new" has no field "moderation"` on every profile
  -- update. One condition per statement is the only version that compiles for
  -- all three tables.
  if tg_table_name = 'school_reviews' then
    if new.moderation is distinct from old.moderation then
      raise exception 'a review is published by a moderator, not by its author'
        using errcode = 'insufficient_privilege';
    end if;
  elsif tg_table_name = 'profiles' then
    if new.tsc_verified is distinct from old.tsc_verified then
      raise exception 'TSC verification is granted by the platform, not by the teacher'
        using errcode = 'insufficient_privilege';
    end if;
  elsif tg_table_name = 'schools' then
    if new.verification is distinct from old.verification then
      raise exception 'a school does not verify itself'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.guard_trust_flags() from public;

create trigger school_reviews_guard_moderation
  before update on school_reviews
  for each row execute function private.guard_trust_flags();

create trigger profiles_guard_tsc_verified
  before update on profiles
  for each row execute function private.guard_trust_flags();

create trigger schools_guard_verification
  before update on schools
  for each row execute function private.guard_trust_flags();

-- ------------------------------------------------------------- the moderator

-- A moderator has to read what nobody else can: the pending review, with its
-- ratings and its red flags. These widen the existing read policies rather
-- than replacing them, so the "author only" rule still holds for everyone else.
create policy school_reviews_read_admin on school_reviews
  for select using (private.is_platform_admin());
create policy review_ratings_read_admin on review_ratings
  for select using (private.is_platform_admin());
create policy review_red_flags_read_admin on review_red_flags
  for select using (private.is_platform_admin());

create policy school_reviews_moderate_admin on school_reviews
  for update using (private.is_platform_admin()) with check (private.is_platform_admin());
create policy schools_verify_admin on schools
  for update using (private.is_platform_admin()) with check (private.is_platform_admin());
create policy profiles_verify_admin on profiles
  for update using (private.is_platform_admin()) with check (private.is_platform_admin());
-- Verifying a TSC number means reading the queue of profiles that have one.
create policy profiles_read_admin on profiles
  for select using (private.is_platform_admin());

-- platform_admins keeps having no policy of its own — membership stays
-- unreadable through PostgREST. The client only needs the answer about itself,
-- which this gives it without exposing who else is staff.
create or replace function public.am_i_platform_admin()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select private.is_platform_admin();
$$;
revoke all on function public.am_i_platform_admin() from public;
grant execute on function public.am_i_platform_admin() to authenticated;
