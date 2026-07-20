-- =========================================================
-- 0044 — OPERATOR TELEGRAM NOTIFICATIONS
-- Staff (operators/admins) can link their own Telegram chat so the bot
-- can ping them the moment a new order needs attention, instead of them
-- having to keep the admin panel open and refresh it manually.
-- Linking flow: staff generates a one-time code in the admin panel, then
-- sends "/link <code>" to the bot from their own Telegram account — the
-- webhook matches the code to their profile and stores the chat id.
-- =========================================================
alter table profiles add column if not exists telegram_chat_id bigint;
alter table profiles add column if not exists telegram_link_code text;
alter table profiles add column if not exists telegram_link_code_expires_at timestamptz;
