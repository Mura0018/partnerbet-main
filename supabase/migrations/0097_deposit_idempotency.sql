-- =========================================================
-- D — DEPOZIT IDEMPOTENTLIGI (topup uchun holat mashinasi)
-- Payout (0092/0093) naqshining ko'zgusi. deposit_status:
--   'none'    -> hali urinilmagan / qayta urinishga tayyor
--   'pending' -> hozir bajarilmoqda (ATOMIK lock) yoki javob kelmadi (timeout)
--   'success' -> pul KIRDI (qaytarilmaydi)
--   'failed'  -> transport xatosi (imzo/tarmoq) — qo'lda tekshiruv
-- deposit_attempt_count — tezkor hisoblagich (0093'dagi kabi ATAYLAB
--   jadval nomidan boshqa: bu faqat son, deposit_attempts esa audit tarixi).
-- deposit_response — oxirgi urinishning xom API javobi (diagnostika).
-- deposit_at — oxirgi urinish vaqti.
-- =========================================================
alter table telegram_orders add column if not exists deposit_status text not null default 'none'
  check (deposit_status in ('none', 'pending', 'success', 'failed'));
alter table telegram_orders add column if not exists deposit_attempt_count int not null default 0;
alter table telegram_orders add column if not exists deposit_response jsonb;
alter table telegram_orders add column if not exists deposit_at timestamptz;

-- ORQAGA-MOSLIK: allaqachon bajarilgan topup buyurtmalar deposit_status
-- 'none' bilan qolsa, yangi qat'iy qoida ularni "qayta urinsa bo'ladi"
-- deb noto'g'ri talqin qilishi mumkin. Shularni 'success'ga backfill —
-- ular hech qachon qayta tegilmaydi.
update telegram_orders
set deposit_status = 'success', deposit_at = coalesce(deposit_at, updated_at, created_at)
where type = 'topup' and status = 'completed' and deposit_status = 'none';

-- =========================================================
-- DEPOZIT URINISHLARI — DOIMIY AUDIT (bloklashsiz, FAQAT qayd).
-- payout_attempts (0093) naqshi, lekin abuse-blok mantig'i YO'Q: depozitni
-- operator boshlaydi, "noto'g'ri kod" tushunchasi yo'q — blok faqat xalaqit
-- berardi. O'CHIRILMAYDI: faqat select + service-role insert.
-- player_id — 1xbet/kassa hisob ID (account_id), matn (ichki FK EMAS).
-- =========================================================
create table if not exists deposit_attempts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references telegram_orders(id) on delete set null,
  customer_id uuid references customers(id) on delete cascade,
  player_id text not null,
  amount numeric(14,2),
  ok boolean not null,
  error text,
  ip text,
  created_at timestamptz not null default now()
);
create index if not exists idx_deposit_attempts_order on deposit_attempts(order_id, created_at desc);
create index if not exists idx_deposit_attempts_player on deposit_attempts(player_id, created_at desc);

alter table deposit_attempts enable row level security;
-- drop-oldin (0094 naqshi): SQL ikkinchi marta ishga tushirilsa
-- "policy already exists" bilan to'xtamasin.
drop policy if exists "deposit_attempts read" on deposit_attempts;
create policy "deposit_attempts read" on deposit_attempts
  for select using (has_permission('telegram_orders.manage'));
-- YOZISH faqat server (service role) — client insert/update/delete
-- policy YO'Q, tarix o'zgartirilmaydi/o'chirilmaydi.
