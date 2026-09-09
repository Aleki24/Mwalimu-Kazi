-- Resources had a table, a list and a download button, and no files.
--
-- No storage bucket existed at all, the eight rows pointed at `seed/*.pdf`
-- paths in it, and the button had no onPress — the one genuinely handler-less
-- press target in the app. The tab was decoration.

insert into storage.buckets (id, name, public)
values ('resources', 'resources', false)
on conflict (id) do nothing;

-- Private rather than public, and read only by signed-in teachers: the
-- library is a reason to have an account, and a public bucket is a URL that
-- outlives any decision to change that.
create policy resources_read_authenticated on storage.objects
  for select to authenticated using (bucket_id = 'resources');

-- Staff curate the library. Teacher uploads are a different feature with their
-- own moderation and abuse story, so the write side is admin-only: it is how
-- the shelf gets stocked at all, and it reuses the moderator that 0016
-- established rather than inventing a second kind of privileged user.
create policy resources_write_admin on storage.objects
  for all to authenticated
  using (bucket_id = 'resources' and private.is_platform_admin())
  with check (bucket_id = 'resources' and private.is_platform_admin());

-- ------------------------------------------------------------ download count
-- Counting through an RPC, not a client UPDATE. `resources` has no update
-- policy and should not get one: a counter the client can write is a counter
-- anyone can inflate, and this one orders the list.
create or replace function public.record_resource_download(target_resource uuid)
returns void language sql security definer set search_path = public, pg_temp as $$
  update resources set download_count = download_count + 1 where id = target_resource;
$$;

revoke all on function public.record_resource_download(uuid) from public;
grant execute on function public.record_resource_download(uuid) to authenticated;
