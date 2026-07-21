-- =========================================================
-- 0054 — CHAT REPLIES, SELF-DELETE, PER-USER THEMES
-- =========================================================

-- Team chat: reply threading + letting someone delete their own message.
alter table team_chat_messages add column if not exists reply_to_id uuid references team_chat_messages(id) on delete set null;

create policy "team_chat_delete_own" on team_chat_messages
  for delete using (sender_id = auth.uid());

-- Support chat: reply threading (customer <-> operator). Deletes for this
-- table go through the existing service-role API routes, not direct
-- client RLS, so no delete policy is needed here.
alter table telegram_support_messages add column if not exists reply_to_id uuid references telegram_support_messages(id) on delete set null;

-- Per-user chat theme — staff and customers each pick their own bubble
-- color scheme independently; a plain key like 'blue' | 'green' |
-- 'purple' | 'sunset', applied client-side.
alter table profiles add column if not exists chat_theme text not null default 'blue';
alter table customers add column if not exists chat_theme text not null default 'blue';
