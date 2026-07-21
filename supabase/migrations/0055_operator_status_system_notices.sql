-- =========================================================
-- 0055 — OPERATOR ONLINE STATUS + SELF-CLEARING SYSTEM NOTICES
-- Written defensively (checks pg_policies before creating) in case an
-- earlier draft of this migration was already partially applied.
-- =========================================================

-- Operator-controlled "on duty" flag. While false, this operator's
-- payment methods are skipped by the fair-rotation pick in
-- /api/telegram/miniapp/payment-info, and their status dot shows red
-- everywhere their name appears in the admin panel.
alter table profiles add column if not exists is_online boolean not null default true;

-- System notices (e.g. "X went offline") posted into team chat. These
-- are distinct from normal messages: any staff member can clear one
-- once everyone has seen it, not just whoever posted it. Seen-tracking
-- lives in its own table (team_chat_message_reads) rather than an array
-- column, so "has everyone seen it" is a simple count comparison.
alter table team_chat_messages add column if not exists is_system boolean not null default false;

create table if not exists team_chat_message_reads (
  message_id uuid not null references team_chat_messages(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  seen_at timestamptz not null default now(),
  primary key (message_id, user_id)
);
alter table team_chat_message_reads enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'team_chat_message_reads' and policyname = 'team_chat_reads_select') then
    create policy "team_chat_reads_select" on team_chat_message_reads
      for select using (has_permission('team_chat.use'));
  end if;

  if not exists (select 1 from pg_policies where tablename = 'team_chat_message_reads' and policyname = 'team_chat_reads_insert') then
    create policy "team_chat_reads_insert" on team_chat_message_reads
      for insert with check (has_permission('team_chat.use') and user_id = auth.uid());
  end if;

  if not exists (select 1 from pg_policies where tablename = 'team_chat_messages' and policyname = 'team_chat_delete_system') then
    create policy "team_chat_delete_system" on team_chat_messages
      for delete using (is_system = true and has_permission('team_chat.use'));
  end if;
end $$;
