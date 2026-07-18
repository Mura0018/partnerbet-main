-- =========================================================
-- 0017 — SUPPORT CHAT (kept from the original skeleton, hardened;
-- backend wiring happens in Phase 4).
-- =========================================================
create table support_conversations (
  id uuid primary key default gen_random_uuid(),
  visitor_name text not null,
  visitor_email text not null,
  status text not null default 'open' check (status in ('open', 'resolved')),
  assigned_admin_id uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_support_conversations_status on support_conversations(status);

create trigger trg_support_conversations_updated_at before update on support_conversations
  for each row execute function public.set_updated_at();

create table support_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references support_conversations(id) on delete cascade,
  sender text not null check (sender in ('visitor', 'admin')),
  message text not null,
  created_at timestamptz not null default now()
);
create index idx_support_messages_conversation on support_messages(conversation_id, created_at);

alter table support_conversations enable row level security;
alter table support_messages enable row level security;

-- Visitors can create a conversation + send messages (no login required for
-- support chat), but cannot read other people's conversations — the app
-- will scope reads through a server-side API route using the service-role
-- key rather than exposing conversations directly to anon SELECT.
create policy "anon insert conversation" on support_conversations
  for insert with check (true);
create policy "support.manage full access conversations" on support_conversations
  for all using (has_permission('support.manage')) with check (has_permission('support.manage'));

create policy "anon insert message" on support_messages
  for insert with check (true);
create policy "support.manage full access messages" on support_messages
  for all using (has_permission('support.manage')) with check (has_permission('support.manage'));
