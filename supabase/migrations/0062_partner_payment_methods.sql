-- =====================================================================
--  HAMKOR TO'LOV USULLARI — o'z Click/Payme/Karta/USDT raqamlari
-- =====================================================================
create table if not exists partner_payment_methods (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references partners(id) on delete cascade,
  kind text not null check (kind in ('click','payme','card','crypto')),
  number text not null,
  holder text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists idx_ppm_partner on partner_payment_methods(partner_id);

alter table partner_payment_methods enable row level security;
create policy "platform manage ppm" on partner_payment_methods
  for all using (has_permission('partners.manage')) with check (has_permission('partners.manage'));
create policy "members read own ppm" on partner_payment_methods
  for select using (partner_id = current_partner_id());
create policy "partner_admin manage own ppm" on partner_payment_methods
  for all using (partner_id = current_partner_id() and is_partner_admin())
  with check (partner_id = current_partner_id() and is_partner_admin());
