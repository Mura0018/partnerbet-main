-- =========================================================
-- 0046 — CHAT ATTACHMENT FILE NAMES
-- So a search for "chek.jpg" (or the start of it) can find the message
-- that has that file attached, not just messages with matching text.
-- =========================================================
alter table team_chat_messages add column if not exists file_name text;
alter table telegram_support_messages add column if not exists file_name text;
