-- =====================================================================
--  HAMKOR TAKLIF (invite) — parolni hamkor o'zi yaratadi
--  Super admin a'zo yaratganda parol qo'ymaydi; havola beriladi; hamkor
--  o'zi parol o'rnatadi. Unutsa super admin havolani qayta hosil qiladi.
-- =====================================================================
create table if not exists partner_invites (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  token text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_partner_invites_token on partner_invites(token);

alter table partner_invites enable row level security;
create policy "platform manage invites" on partner_invites
  for all using (has_permission('partners.manage')) with check (has_permission('partners.manage'));
