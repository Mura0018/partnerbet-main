-- =========================================================
-- W1.4 — ISM SOLISHTIRISH: qo'lda tasdiqlash (MAJBURIY qayd bilan).
--
-- customers'ga override ustunlari: operator (yoki super_admin) mos
-- kelmagan ismni "bu haqiqatan shu mijoz" deb tasdiqlasa, shu yerga
-- yoziladi — KIM, QACHON, NIMA SABABDAN. Override qo'yilgach, shu
-- mijoz uchun kelgusi buyurtmalarda ism tekshiruvi o'tkazib yuboriladi
-- (qayta-qayta bir xil operator bilan bloklanib qolmasin).
--
-- name_mismatch_flags — operatorlar uchun "ko'rib chiqish" ro'yxati:
-- mos kelmagani sababli BLOKLANGAN har bir urinish shu yerga yoziladi
-- (buyurtma hali yaratilmagan bo'lgani uchun telegram_orders'ga emas).
-- =========================================================

alter table customers add column if not exists name_override_by uuid references profiles(id) on delete set null;
alter table customers add column if not exists name_override_at timestamptz;
alter table customers add column if not exists name_override_reason text;

create table if not exists name_mismatch_flags (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  registered_name text not null,
  player_name text not null,
  platform text,
  account_id text,
  status text not null default 'pending' check (status in ('pending', 'resolved')),
  created_at timestamptz not null default now()
);
create index if not exists idx_name_mismatch_flags_customer on name_mismatch_flags(customer_id, status);

alter table name_mismatch_flags enable row level security;
create policy "name_mismatch_flags read" on name_mismatch_flags
  for select using (has_permission('telegram_orders.manage'));
-- YOZISH/YANGILASH faqat server (service role) orqali — client-side
-- insert/update policy yo'q.
