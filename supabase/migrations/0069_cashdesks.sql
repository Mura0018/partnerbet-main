-- =====================================================================
--  KOP KASSA (MULTI-CASHDESK) — 1-BOSQICH: POYDEVOR
--  cashdesks jadvali (har kassa uchun alohida shifrlangan kalitlar) +
--  cashdesks.manage ruxsati (faqat super_admin).
--
--  MUHIM: pass_enc / hash_enc bazaga SHIFRLANGAN yoziladi (encryptSecret,
--  AES-256-GCM). Bu migratsiya HECH QANDAY maxfiy kalit yozmaydi — mavjud
--  bitta kassani kochirish server endpoint orqali (import-legacy) bolib,
--  server shifrlaydi. ENCRYPTION_KEY faqat serverda, SQL shifrlay olmaydi.
-- =====================================================================

create table if not exists cashdesks (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  cashdesk_id text not null,
  login text not null,
  pass_enc text not null,
  hash_enc text not null,
  owner_operator_id uuid references profiles(id) on delete set null,
  is_active boolean not null default true,
  region text,
  low_balance_threshold numeric(14,2),
  low_balance_notified_at timestamptz,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_cashdesks_cashdesk_id on cashdesks(cashdesk_id);
create index if not exists idx_cashdesks_active on cashdesks(is_active, created_at);
create index if not exists idx_cashdesks_owner on cashdesks(owner_operator_id);

alter table cashdesks enable row level security;

-- Faqat cashdesks.manage (super_admin) oqiydi/boshqaradi. Amalda barcha
-- yozish/oqish server (service role) orqali, maxfiy kalitlar hech qachon
-- brauzerga qaytmaydi. Bu policy qoshimcha himoya qatlami.
create policy "cashdesks manage all" on cashdesks
  for all using (has_permission('cashdesks.manage')) with check (has_permission('cashdesks.manage'));

-- cashdesks.manage ruxsati -> faqat super_admin
insert into permissions (key, description)
values ('cashdesks.manage', 'Kassalarni boshqarish')
on conflict (key) do nothing;

insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r cross join permissions p
where r.key = 'super_admin' and p.key = 'cashdesks.manage'
on conflict (role_id, permission_id) do nothing;
