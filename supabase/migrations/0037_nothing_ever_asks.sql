-- Nothing ever asks.
--
-- There are zero reviews in production. Not because the form is broken — it
-- works, it has ten categories, red flags, a moderator behind it — but because
-- the only way to reach it is to think of a school, search for it, open its
-- page and notice a link. Nobody does that. So the one thing this app has that
-- a Facebook group does not — what teachers say about the school before you
-- apply — is an empty shelf, on every school page, for every reader.
--
-- The app already knows exactly who has something to say. Somebody who
-- interviewed at a school has met them. Somebody who was turned down by one
-- has been answered by them. Somebody on the staff works there. All three are
-- rows this database already holds, and none of them has ever been asked a
-- question.
--
-- Two things here: a way to ask the right person about the right school, and
-- the missing half of the moderation loop — a teacher writes a review, a
-- moderator publishes it a day later, and until now nobody told the author.
--
-- `notification_kind` has had `school_review` since 0004 and, like the four in
-- 0035, nothing has ever written one.

-- ------------------------------------------------------ who could say what

/**
 * Not a view and not a client-side join.
 *
 * `school_reviews.author_id` is deliberately unreadable — the schema has said
 * since 0004 that the API must never select it, because a review that can be
 * traced to the teacher who wrote it is a review nobody will write. But
 * "which schools have I not reviewed" is a question about author_id. A
 * definer function can answer it about the caller and only about the caller,
 * which is the whole reason this is a function.
 */
create or replace function public.reviews_i_could_write()
returns table (
  school_id   uuid,
  school_name text,
  school_slug text,
  -- 'works_there' | 'interviewed' | 'answered'. The screen turns these into a
  -- sentence; keeping the word here rather than the sentence means the copy
  -- can change without a migration.
  reason      text,
  -- The role they applied for, so the form opens with it filled in rather than
  -- asking somebody to remember the wording of a vacancy from three weeks ago.
  role_title  text
)
language sql stable security definer set search_path = public, pg_temp as $$
  with me as (select auth.uid() as id),
  standing as (
    -- On the staff. The strongest thing anybody can say about a school.
    select m.school_id, 1 as strength, 'works_there'::text as reason,
           null::text as role_title, now() as at
      from school_members m, me
     where m.user_id = me.id

    union all

    -- Met them, or was answered by them. `applied` is not here: submitting a
    -- form is not an experience of a school, and a review written off the back
    -- of one would be a review of a job advert.
    select j.school_id,
           case when a.stage in ('interview', 'offered') then 2 else 3 end,
           case when a.stage in ('interview', 'offered') then 'interviewed' else 'answered' end,
           j.title,
           coalesce(a.decided_at, a.created_at)
      from applications a
      join jobs j on j.id = a.job_id, me
     where a.teacher_id = me.id
       and j.school_id is not null
       and a.stage in ('viewed', 'shortlisted', 'interview', 'offered', 'rejected')
  ),
  -- One row per school, keeping the strongest claim they have on it.
  best as (
    select distinct on (s.school_id) s.*
      from standing s
     order by s.school_id, s.strength, s.at desc
  )
  select b.school_id, sc.name, sc.slug, b.reason, b.role_title
    from best b
    join schools sc on sc.id = b.school_id, me
   where me.id is not null
     -- Already written about, published or not. The unique constraint would
     -- refuse a second one anyway; asking for it would just be rude.
     and not exists (
       select 1 from school_reviews r
        where r.school_id = b.school_id and r.author_id = me.id
     )
   order by b.strength, b.at desc
   limit 10;
$$;

revoke execute on function public.reviews_i_could_write() from public, anon;
grant execute on function public.reviews_i_could_write() to authenticated;

-- --------------------------------------------- and what happened to it after

create or replace function private.notify_review_moderated()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare v_school text;
begin
  if new.moderation is not distinct from old.moderation then return new; end if;
  if new.moderation = 'pending' then return new; end if;

  select name into v_school from schools where id = new.school_id;

  if new.moderation = 'approved' then
    insert into notifications (user_id, kind, title, body, payload)
    values (new.author_id, 'school_review', 'Your review is live',
            format('What you wrote about %s is on their page now. Teachers deciding whether to apply there will read it.',
                   coalesce(v_school, 'that school')),
            jsonb_build_object('school_id', new.school_id, 'review_id', new.id));
  else
    -- Saying nothing would be worse. A teacher who spent ten minutes on this
    -- and never hears back learns that the form is a bin.
    insert into notifications (user_id, kind, title, body, payload)
    values (new.author_id, 'school_review', 'Your review was not published',
            format('A moderator did not publish what you wrote about %s. Reviews are held when they name an individual or cannot be checked.',
                   coalesce(v_school, 'that school')),
            jsonb_build_object('school_id', new.school_id, 'review_id', new.id));
  end if;

  return new;
end;
$$;
revoke all on function private.notify_review_moderated() from public;

create trigger school_reviews_notify_moderated
  after update on school_reviews
  for each row execute function private.notify_review_moderated();
