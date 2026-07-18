-- =========================================================
-- 0019 — STORAGE BUCKETS
-- =========================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('media', 'media', true, 20971520, array['image/png','image/jpeg','image/webp','image/svg+xml','video/mp4']),
  ('apk',   'apk',   true, 209715200, array['application/vnd.android.package-archive'])
on conflict (id) do nothing;

-- Public read for both buckets (images/APK must load without auth).
create policy "public read media bucket" on storage.objects
  for select using (bucket_id = 'media');
create policy "public read apk bucket" on storage.objects
  for select using (bucket_id = 'apk');

-- Uploads/deletes require the matching manage permission.
create policy "media.manage upload media bucket" on storage.objects
  for insert with check (bucket_id = 'media' and has_permission('media.manage'));
create policy "media.manage update media bucket" on storage.objects
  for update using (bucket_id = 'media' and has_permission('media.manage'));
create policy "media.manage delete media bucket" on storage.objects
  for delete using (bucket_id = 'media' and has_permission('media.manage'));

create policy "apk.manage upload apk bucket" on storage.objects
  for insert with check (bucket_id = 'apk' and has_permission('apk.manage'));
create policy "apk.manage update apk bucket" on storage.objects
  for update using (bucket_id = 'apk' and has_permission('apk.manage'));
create policy "apk.manage delete apk bucket" on storage.objects
  for delete using (bucket_id = 'apk' and has_permission('apk.manage'));
