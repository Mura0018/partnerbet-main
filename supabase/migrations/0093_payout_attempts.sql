-- =========================================================
-- W2 QO'SHIMCHA — PAYOUT URINISHLARINI CHEKLASH (abuse-himoya, doimiy audit)
-- Har bir payout urinishi (muvaffaqiyatli HAM, muvaffaqiyatsiz HAM) shu
-- yerga yoziladi. O'CHIRILMAYDI (faqat select + service-role insert —
-- order_confirmations/requisite_reveals bilan bir xil naqsh).
--
-- player_id — mijozning 1xbet/kassa hisob ID'si (account_id), ICHKI
-- jadvalga FK EMAS (tashqi platforma identifikatori, matn sifatida).
-- Bitta mijoz VA bitta player_id alohida-alohida cheklanadi (mijoz
-- almashtirsa ham — bir xil player_id'ga qarshi urinishlar hisoblanadi).
--
-- customers.payout_blocked_until / payout_player_blocks — limitdan
-- oshgan customer/player uchun 24 soatlik blok belgisi. Muvaffaqiyatli
-- payoutdan keyin ikkalasi ham tozalanadi ("hisob nolga tushadi").
-- Sonlar (5 ta / 1 soat, 24 soat blok) KODGA QATTIQ YOZILMAGAN —
-- site_settings.betcore_payout_limits'dan o'qiladi.
-- =========================================================

create table if not exists payout_attempts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  player_id text not null,
  ok boolean not null,
  error text,
  ip text,
  created_at timestamptz not null default now()
);
create index if not exists idx_payout_attempts_customer on payout_attempts(customer_id, created_at desc);
create index if not exists idx_payout_attempts_player on payout_attempts(player_id, created_at desc);

alter table payout_attempts enable row level security;
create policy "payout_attempts read" on payout_attempts
  for select using (has_permission('telegram_orders.manage'));
-- YOZISH faqat server (service role) — client-side insert/update/delete
-- policy YO'Q, shuning uchun tarix o'zgartirilmaydi/o'chirilmaydi.

alter table customers add column if not exists payout_blocked_until timestamptz;

create table if not exists payout_player_blocks (
  player_id text primary key,
  blocked_until timestamptz not null,
  updated_at timestamptz not null default now()
);
alter table payout_player_blocks enable row level security;
create policy "payout_player_blocks read" on payout_player_blocks
  for select using (has_permission('telegram_orders.manage'));

insert into site_settings (key, value)
values (
  'betcore_payout_limits',
  jsonb_build_object(
    'max_failed_per_hour', 5,
    'block_hours', 24
  )
)
on conflict (key) do nothing;
