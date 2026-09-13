-- A helper with an open search path.
--
-- `private.is_short_list` has been the only function in the project without a
-- pinned `search_path` since 0024, and the advisor has flagged it every run.
-- It is used inside check constraints on the CV tables, which is the worst
-- place for it: a constraint is evaluated with whatever search_path the
-- session has, so the `unnest` and `btrim` it calls are resolved against a
-- path the caller controls.
--
-- Nothing is exploitable today — those are pg_catalog functions and the role
-- that could shadow them already owns the database. It is pinned here because
-- "nothing is exploitable today" is the sentence that precedes every one of
-- these, and because a green advisor run is worth more than a familiar warning.
--
-- Replacing it in place keeps the constraints that depend on it valid; the
-- signature and the body are unchanged.

create or replace function private.is_short_list(items text[], max_items integer default 20)
returns boolean language sql immutable set search_path = pg_catalog, pg_temp as $$
  select cardinality(items) <= max_items
     and not exists (
       select 1 from unnest(items) as item
       where btrim(item) = '' or char_length(item) > 300
     );
$$;
