-- =========================================================
-- 0048 — VOICE MESSAGES
-- Adds voice attachments to both chats, same private/public bucket split
-- as images (support-attachments stays private, team-chat-attachments
-- stays public). Browser-recorded audio (webm/ogg/mp4) is stored as-is —
-- no transcoding — so playback is via the web UI's <audio> element, not
-- forwarded as a native Telegram voice message (format compatibility);
-- the Telegram push for an operator's voice reply is a text fallback
-- telling the customer to open the app and listen.
-- =========================================================
alter table team_chat_messages add column if not exists voice_path text;
alter table team_chat_messages add column if not exists voice_duration_seconds int;
alter table team_chat_messages drop constraint if exists chk_message_or_image;
alter table team_chat_messages add constraint chk_message_or_image check (
  (message is not null and char_length(message) > 0) or image_path is not null or voice_path is not null
);

alter table telegram_support_messages add column if not exists voice_path text;
alter table telegram_support_messages add column if not exists voice_duration_seconds int;
alter table telegram_support_messages drop constraint if exists chk_message_or_image;
alter table telegram_support_messages add constraint chk_message_or_image check (
  (message is not null and char_length(message) > 0) or image_path is not null or voice_path is not null
);

update storage.buckets
set allowed_mime_types = array['image/png','image/jpeg','image/webp','audio/webm','audio/ogg','audio/mp4','audio/mpeg']
where id in ('support-attachments', 'team-chat-attachments');
