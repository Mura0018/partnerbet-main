-- =====================================================================
--  W1.2 — REKVIZIT KO'RSATISH TARIXI (audit, doimiy)
--  Har safar mijozga to'lov rekvizitlari (karta/Click/Payme/kripto)
--  ko'rsatilganda — kim (mijoz), qaysi buyurtma uchun, qaysi kartaning
--  egasi (operator/hamkor), qaysi IP'dan — shu yerga qayd etiladi.
--  Karta bloklansa (masalan firibgarlik gumoni), kim uni qachon ko'rgani
--  aniq bo'ladi. account_number/holder_name DENORMALIZED (karta o'zi
--  keyinchalik o'chirilsa/o'zgarsa ham, tarixiy yozuv o'zgarmas qoladi).
--  O'CHIRILMAYDI: hech qanday update/delete policy yo'q (faqat select +
--  service-role insert) — shuning uchun tarix client tomondan buzilmaydi.
-- =====================================================================

create table if not exists requisite_reveals (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  order_id uuid not null references telegram_orders(id) on delete cascade,
  method_type text not null check (method_type in ('card', 'click', 'payme', 'crypto')),
  -- Platforma mijozi -> operator_id to'ldiriladi, partner_id bo'sh.
  -- Hamkor mijozi -> partner_id to'ldiriladi, operator_id bo'sh.
  operator_id uuid references profiles(id) on delete set null,
  partner_id uuid references partners(id) on delete set null,
  account_number text not null,
  holder_name text,
  ip text,
  created_at timestamptz not null default now()
);

create index if not exists idx_requisite_reveals_customer on requisite_reveals(customer_id, created_at desc);
create index if not exists idx_requisite_reveals_order on requisite_reveals(order_id);
create index if not exists idx_requisite_reveals_operator on requisite_reveals(operator_id, created_at desc);

alter table requisite_reveals enable row level security;

-- Xodimlar (telegram_orders.manage) o'qiydi. YOZISH faqat server
-- (service role, payment-info/orders endpoint) — client-side insert
-- policy YO'Q. UPDATE/DELETE policy ham YO'Q — yozuv umuman
-- o'zgartirilmaydi/o'chirilmaydi (RLS standart holatda hammasini
-- man qiladi, faqat pastdagi SELECT policy ochiq).
create policy "requisite_reveals read" on requisite_reveals
  for select using (has_permission('telegram_orders.manage'));
