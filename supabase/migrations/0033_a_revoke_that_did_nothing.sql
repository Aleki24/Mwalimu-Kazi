-- A revoke that did nothing.
--
-- `find_tutors` and `invite_tutor` each ended with
--
--   revoke execute on function … from anon;
--
-- which reads like it closes the door and does not. Postgres grants EXECUTE on
-- a new function to PUBLIC, and `anon` is a member of PUBLIC, so taking away
-- anon's own grant leaves the inherited one untouched. The advisor caught it:
-- both functions were still callable through `/rest/v1/rpc/…` with nothing but
-- the publishable key.
--
-- What it would have cost: `find_tutors` is the whole directory — every listed
-- teacher's name, area, subjects and rate — and it was one unauthenticated
-- POST away. The `auth.uid() is not null` line inside the function is what
-- actually held the line, which is a thin thing to be relying on by accident.
--
-- So: take the grant off PUBLIC, then hand it to the one role that should have
-- it. The other three SECURITY DEFINER functions in `public` are the same
-- shape — none of them is meant for somebody who has not signed in — so they
-- lose `anon` here too.

revoke execute on function
  public.find_tutors(uuid, text, text, boolean, boolean, text, int)
  from public, anon;
grant execute on function
  public.find_tutors(uuid, text, text, boolean, boolean, text, int)
  to authenticated;

revoke execute on function public.invite_tutor(uuid, uuid) from public, anon;
grant execute on function public.invite_tutor(uuid, uuid) to authenticated;

-- Returns false for a signed-out caller, but there is no reason to answer the
-- question at all before sign-in.
revoke execute on function public.am_i_platform_admin() from public, anon;
grant execute on function public.am_i_platform_admin() to authenticated;

-- Creating a school is something an account does, never a visitor.
revoke execute on function
  public.create_school(text, text, school_type, curriculum[]) from public, anon;
grant execute on function
  public.create_school(text, text, school_type, curriculum[]) to authenticated;

-- The download counter was made SECURITY DEFINER so it could not be forged;
-- leaving it open to anon let anybody inflate it without an account.
revoke execute on function public.record_resource_download(uuid) from public, anon;
grant execute on function public.record_resource_download(uuid) to authenticated;
