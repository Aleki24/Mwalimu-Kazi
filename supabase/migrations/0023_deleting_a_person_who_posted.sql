-- Deleting a person who has posted something.
--
-- `jobs.posted_by` is ON DELETE SET NULL and `jobs_attributable` requires that
-- a listing has either a school or a poster. Together they mean that anybody
-- who has ever posted an individual listing — a locum vacancy, a tuition
-- request — cannot be deleted at all: the delete reaches the check constraint
-- and raises 23514. Found while tearing down fixtures, but it is the same code
-- path as a real person asking for their account to be removed, and as a
-- moderator removing an abusive one.
--
-- The two halves want opposite things, so the trigger separates them:
--
--   * A listing that is only theirs — no school — dies with them. A household
--     request whose household is gone is a dead end; nobody can be contacted
--     through it, and leaving it visible is worse than losing it.
--
--   * A school's vacancy outlives the member of staff who typed it. There the
--     FK's SET NULL is exactly right, and the constraint is satisfied because
--     `school_id` is still there.
--
-- BEFORE DELETE on `profiles` rather than on `auth.users`: the profile row is
-- what `jobs.posted_by` actually references, and deleting an auth user cascades
-- through it either way.

create or replace function private.drop_unattributable_listings()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  -- Only the ones that would violate `jobs_attributable`. The school's keep
  -- their row and lose their author.
  delete from jobs where posted_by = old.id and school_id is null;
  return old;
end;
$$;

drop trigger if exists drop_unattributable_listings on profiles;
create trigger drop_unattributable_listings
  before delete on profiles
  for each row execute function private.drop_unattributable_listings();
