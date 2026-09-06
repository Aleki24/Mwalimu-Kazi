-- Hardening pass, from the Supabase security advisor after 0001.
--
-- Two issues, both about the API surface rather than the row rules:
--
-- 1. is_school_member() was SECURITY DEFINER and lived in `public`, so PostgREST
--    exposed it at /rest/v1/rpc/is_school_member to anyone, signed in or not.
--    Moving it to a schema PostgREST does not expose removes the endpoint while
--    RLS policies can still call it.
-- 2. The private tables were readable by `anon`. RLS already returns zero rows,
--    but there is no reason for a signed-out client to reach them at all.

create schema if not exists private;
grant usage on schema private to authenticated, service_role;

-- Recreated here rather than in public. search_path is pinned so a caller
-- cannot shadow school_members with their own object.
create or replace function private.is_school_member(target_school uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from school_members m
    where m.school_id = target_school and m.user_id = auth.uid()
  );
$$;

revoke all on function private.is_school_member(uuid) from public;
grant execute on function private.is_school_member(uuid) to authenticated, service_role;

-- Policies must be repointed before the old function can be dropped.
drop policy if exists school_members_select_own on school_members;
drop policy if exists jobs_select_published on jobs;
drop policy if exists jobs_write_members on jobs;
drop policy if exists applications_select_school on applications;
drop policy if exists applications_update_school on applications;

create policy school_members_select_own on school_members
  for select using (user_id = auth.uid() or private.is_school_member(school_id));

create policy jobs_select_published on jobs
  for select using (published or private.is_school_member(school_id));
create policy jobs_write_members on jobs
  for all using (private.is_school_member(school_id)) with check (private.is_school_member(school_id));

create policy applications_select_school on applications
  for select using (
    exists (select 1 from jobs j where j.id = applications.job_id and private.is_school_member(j.school_id))
  );
create policy applications_update_school on applications
  for update using (
    exists (select 1 from jobs j where j.id = applications.job_id and private.is_school_member(j.school_id))
  );

drop function if exists public.is_school_member(uuid);

-- Schools and published jobs stay readable signed-out: browsing vacancies
-- before creating an account is a feature, not an oversight.
revoke select on table profiles, applications, auto_apply_rules, auto_apply_events, school_members from anon;
