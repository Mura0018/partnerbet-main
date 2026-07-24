-- =====================================================================
--  B7 (C) — QR SKANER QAYDI
--  Operator mijoz sovrin kartasini (QR/kod) skanerlaganда har safar qayd
--  etiladi: kim skanerledi, qachon, qaysi karta/mijoz. telegram_orders.manage
--  (operator) o'qiydi. Yozish server (service role) orqali.
-- =====================================================================

create table if not exists promo_scans (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id) on delete set null,
  card_code text,
  scanned_by uuid references profiles(id) on delete set null,
  scanned_at timestamptz not null default now()
);

create index if not exists idx_promo_scans_customer on promo_scans(customer_id, scanned_at desc);
create index if not exists idx_promo_scans_scanner on promo_scans(scanned_by, scanned_at desc);

alter table promo_scans enable row level security;
create policy "promo_scans read" on promo_scans
  for select using (has_permission('telegram_orders.manage'));
