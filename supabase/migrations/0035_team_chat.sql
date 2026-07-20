alter table profiles add column display_name text;
alter table profiles add column avatar_url text;

insert into permissions (key, description) values
  ('team_chat.use', 'Read and post in the shared staff/operator chat');

insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r, permissions p
where r.key in ('super_admin', 'admin', 'operator') and p.key = 'team_chat.use';

create table team_chat_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references profiles(id) on delete cascade,
  message text not null,
  created_at timestamptz not null default now()
);
create index team_chat_messages_created_at_idx on team_chat_messages (created_at);

alter table team_chat_messages enable row level security;

create policy "team_chat_select" on team_chat_messages
  for select using (has_permission('team_chat.use'));

create policy "team_chat_insert" on team_chat_messages
  for insert with check (has_permission('team_chat.use') and sender_id = auth.uid());
