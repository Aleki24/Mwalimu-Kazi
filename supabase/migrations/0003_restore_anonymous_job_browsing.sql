-- Fixes a regression introduced by 0002.
--
-- 0002 granted EXECUTE on private.is_school_member() to `authenticated` only.
-- But the jobs and schools SELECT policies reference that function, and Postgres
-- checks EXECUTE permission when it evaluates the policy — it does not
-- short-circuit past the function just because `published` is already true.
-- So every anonymous read of /rest/v1/jobs failed with:
--
--   42501: permission denied for function is_school_member
--
-- which broke browsing vacancies before signing up: the thing 0002's own
-- comment said it was preserving. Caught by issuing a real anonymous request —
-- the type checker and the unit tests cannot see this.
--
-- Granting anon EXECUTE is safe. The function reads auth.uid(), which is null
-- for an anonymous caller, so it returns false and the policy falls back to the
-- `published` branch. It stays in the `private` schema, so PostgREST still does
-- not expose it as an RPC endpoint — that was 0002's actual concern.

grant usage on schema private to anon;
grant execute on function private.is_school_member(uuid) to anon;
