-- =====================================================================
--  HAMKOR — XIZMAT BIRIKTIRISH (provisioning) + HISOB-KITOB (billing)
--  Supabase SQL Editor'da bir marta ishga tushiring. Faqat yangi jadvallar.
-- =====================================================================

-- 1) Xizmatlar katalogi (super admin biriktiradigan xizmatlar)
create table if not exists partner_services (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into partner_services (key, name, description) values
  ('topup',       'Hisob to''ldirish',   'Mijoz hisobini to''ldirish xizmati'),
  ('withdraw',    'Pul yechish',         'Mijozga pul yechish xizmati'),
  ('team_chat',   'Jamoa chati',         'Ichki operatorlar chati'),
  ('global_chat', 'Global chat',         'Hamkorlar aro umumiy chat'),
  ('api_1xbet',   '1xbet API',           'Kassa/1xbet API integratsiyasi'),
  ('analytics',   'Analitika',           'Dashboard va hisobotlar')
on conflict (key) do nothing;

-- 2) Hamkorga biriktirilgan xizmatlar (super admin qo'lda yoqadi)
create table if not exists partner_service_assignments (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references partners(id) on delete cascade,
  service_id uuid not null references partner_services(id) on delete cascade,
  enabled boolean not null default true,
  assigned_by uuid references profiles(id),
  assigned_at timestamptz not null default now(),
  unique (partner_id, service_id)
);
create index if not exists idx_psa_partner on partner_service_assignments(partner_id);

-- 3) Hisob-kitob (billing) — komissiya/obuna to'lovlari yozuvi
create table if not exists partner_invoices (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references partners(id) on delete cascade,
  period text not null,                    -- masalan '2026-07'
  model text not null check (model in ('commission','subscription')),
  amount numeric(14,2) not null default 0,
  currency text not null default 'UZS',
  status text not null default 'unpaid' check (status in ('unpaid','paid')),
  note text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create index if not exists idx_invoices_partner on partner_invoices(partner_id, period);

-- =====================================================================
--  RLS
-- =====================================================================
alter table partner_services enable row level security;
create policy "read services" on partner_services
  for select using (current_partner_id() is not null or has_permission('partners.manage'));
create policy "platform manage services" on partner_services
  for all using (has_permission('partners.manage')) with check (has_permission('partners.manage'));

alter table partner_service_assignments enable row level security;
create policy "platform manage assignments" on partner_service_assignments
  for all using (has_permission('partners.manage')) with check (has_permission('partners.manage'));
create policy "members read own assignments" on partner_service_assignments
  for select using (partner_id = current_partner_id());

alter table partner_invoices enable row level security;
create policy "platform manage invoices" on partner_invoices
  for all using (has_permission('partners.manage')) with check (has_permission('partners.manage'));
create policy "partner_admin read own invoices" on partner_invoices
  for select using (partner_id = current_partner_id() and is_partner_admin());

-- TAYYOR. "men qo'ydim" deng — provisioning va hisob-kitob UI'sini yozaman.
