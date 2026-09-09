-- News was six invented claims about real institutions.
--
-- "TSC announces recruitment of 20,000 intern teachers. Applications open next
-- month across all 47 counties" — attributed to TSC, dated, and false, because
-- nobody wrote it from a source. Every row had `body` and `url` null too, so
-- there was nothing to open even if the feed had been tappable, which it was
-- not: no Pressable, no detail route.
--
-- A fabricated exam paper wastes a teacher's afternoon. A fabricated TSC
-- recruitment notice sends them to a county office. Those rows are deleted in
-- the same change that makes it possible to write real ones.
--
-- Authoring is admin-only, reusing the moderator 0016 established. News is the
-- platform speaking in its own voice about named institutions, so the set of
-- people who can do it is exactly the set already trusted to publish a review.

create policy news_write_admin on news_articles
  for all to authenticated
  using (private.is_platform_admin())
  with check (private.is_platform_admin());

-- A dated claim about a named body needs somewhere the reader can check it.
-- Not enforced as NOT NULL because a KICD circular is sometimes only on paper,
-- but the composer asks for it and the article says so when it is missing.
comment on column news_articles.url is
  'Where the claim can be checked. The reader shows "Read at source" when set.';
