-- =========================================================
-- 0041 — SUPPORT CHAT IMAGE ATTACHMENTS
-- Customers can now attach a screenshot to a support message (e.g. an
-- unclear payment issue). Same private-bucket pattern as receipts —
-- upload via service-role only, staff view via short-lived signed URL.
-- =========================================================
alter table telegram_support_messages alter column message drop not null;
alter table telegram_support_messages drop constraint if exists telegram_support_messages_message_check;
alter table telegram_support_messages add constraint chk_message_length check (message is null or char_length(message) <= 2000);
alter table telegram_support_messages add column if not exists image_path text;
alter table telegram_support_messages add constraint chk_message_or_image check (
  (message is not null and char_length(message) > 0) or image_path is not null
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('support-attachments', 'support-attachments', false, 5242880, array['image/png','image/jpeg','image/webp'])
on conflict (id) do nothing;
