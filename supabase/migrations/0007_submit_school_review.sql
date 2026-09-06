-- One transactional entry point for writing a review.
--
-- A review is three tables: the review, its category ratings, and any red
-- flags. Done as three round trips from the client, a failure after the first
-- leaves a review with no ratings — which the domain schema says cannot exist
-- (`ratings: z.array(CategoryRating).min(1)`), and which would then be
-- unparseable forever. A function body is one transaction, so this cannot
-- half-land.
--
-- SECURITY INVOKER, deliberately. It runs as the calling teacher, so every RLS
-- policy on all three tables still applies and the function grants no privilege
-- the caller did not already have. It exists for atomicity, not for access.
--
-- `employment_verified` is NOT a parameter. It is the difference between a
-- review that means something and one that does not, so it must never be
-- assertable by the client that benefits from it.
create function public.submit_school_review(
  p_school_id  uuid,
  p_role_title text,
  p_body       text,
  p_ratings    jsonb,
  p_red_flags  jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  new_id uuid;
begin
  if jsonb_typeof(p_ratings) <> 'array' or jsonb_array_length(p_ratings) = 0 then
    raise exception 'a review needs at least one category rating'
      using errcode = 'check_violation';
  end if;

  if jsonb_typeof(p_red_flags) <> 'array' or jsonb_array_length(p_red_flags) > 4 then
    raise exception 'at most four red flags per review'
      using errcode = 'check_violation';
  end if;

  insert into school_reviews (school_id, author_id, role_title, body)
  values (p_school_id, auth.uid(), nullif(btrim(coalesce(p_role_title, '')), ''), p_body)
  returning id into new_id;

  insert into review_ratings (review_id, category, score)
  select new_id, (r ->> 'category')::review_category, (r ->> 'score')::smallint
  from jsonb_array_elements(p_ratings) as r;

  insert into review_red_flags (review_id, kind, reason, occurred_on)
  select
    new_id,
    (f ->> 'kind')::red_flag_kind,
    f ->> 'reason',
    nullif(f ->> 'occurred_on', '')::date
  from jsonb_array_elements(p_red_flags) as f;

  return new_id;
end;
$$;

revoke all on function public.submit_school_review(uuid, text, text, jsonb, jsonb) from public;
grant execute on function public.submit_school_review(uuid, text, text, jsonb, jsonb) to authenticated;
