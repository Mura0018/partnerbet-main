-- =========================================================
-- 0043 — TEAM CHAT IMAGE ATTACHMENTS
-- Staff can attach an image to a team chat message. Unlike receipts/
-- support-attachments (customer financial screenshots, kept private),
-- team chat photos are low-sensitivity internal content, so this bucket
-- is public — same trust level as the "media" bucket already is.
-- =========================================================
alter table team_chat_messages alter column message drop not null;
alter table team_chat_messages add constraint chk_message_length check (message is null or char_length(message) <= 2000);
alter table team_chat_messages add column if not exists image_path text;
alter table team_chat_messages add constraint chk_message_or_image check (
  (message is not null and char_length(message) > 0) or image_path is not null
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('team-chat-attachments', 'team-chat-attachments', true, 5242880, array['image/png','image/jpeg','image/webp'])
on conflict (id) do nothing;

create policy "public read team-chat-attachments" on storage.objects
  for select using (bucket_id = 'team-chat-attachments');
create policy "team_chat.use upload team-chat-attachments" on storage.objects
  for insert with check (bucket_id = 'team-chat-attachments' and has_permission('team_chat.use'));
