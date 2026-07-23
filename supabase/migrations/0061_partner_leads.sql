-- =====================================================================
--  HAMKORLIK SO'ROVLARI (leads) — appdan super admin inboxiga
--  Insert SERVER (service role) orqali bo'ladi; klientdan to'g'ridan yozish yo'q.
-- =====================================================================
create table if not exists partner_leads (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id) on delete set null,
  name text,
  phone text,
  company text,
  message text,
  status text not null default 'new' check (status in ('new','contacted','converted','rejected')),
  handled_by uuid references profiles(id),
  handled_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_partner_leads_status on partner_leads(status, created_at desc);

alter table partner_leads enable row level security;
-- Faqat super admin (partners.manage) o'qiydi/boshqaradi. Insert service role orqali.
create policy "platform manage leads" on partner_leads
  for all using (has_permission('partners.manage')) with check (has_permission('partners.manage'));
