-- =====================================================================
--  KOP KASSA — 5-BOSQICH: TELEFON TASDIQI
--  Operator mijozga qo'ng'iroq qilib "shuncha mablag' qabul qildingizmi?"
--  deб so'raganда javobni PANELDA qayd qiladi. Nizoda dalil: kim, qachon,
--  qancha, tasdiqladimi. Qaydlar O'CHIRILMAYDI (tarix).
-- =====================================================================

create table if not exists order_confirmations (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references telegram_orders(id) on delete cascade,
  operator_id uuid references profiles(id) on delete set null,
  confirmed boolean not null,
  amount numeric(14,2),
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_order_confirmations_order on order_confirmations(order_id, created_at);

alter table order_confirmations enable row level security;

-- Xodimlar (telegram_orders.manage) o'qiydi (buyurtma batafsilida dalil).
-- YOZISH faqat server (service role) orqali — mas'ul operator/admin
-- tekshiruvi API'да (confirm-phone). Shuning uchun insert policy yo'q.
create policy "order_confirmations read" on order_confirmations
  for select using (has_permission('telegram_orders.manage'));
