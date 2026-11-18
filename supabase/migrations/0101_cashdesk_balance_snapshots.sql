-- =====================================================================
--  KASSA BALANSI — 5-BOSQICH: SOATLIK SNAPSHOT TARIXI
--  Cron (/api/cron/check-cashdesk-balances) har soatda BARCHA aktiv
--  kassalar balansini oladi va shu jadvalga yozadi (threshold'i yo'q
--  kassalar ham — tarix to'liq bo'lsin). API xato bersa ham qator
--  yoziladi (ok=false + error), bo'shliq ko'rinib tursin.
--
--  credit_limit — API'dagi "Limit" maydoni ("limit" SQL zahiralangan
--  so'zi bo'lgani uchun boshqa nom).
--  threshold — o'sha paytdagi low_balance_threshold nusxasi (keyin
--  chegara o'zgarsa ham tarix to'g'ri talqin qilinadi).
--
--  Yozish faqat server (service role) orqali. Policy faqat o'qish uchun
--  (cashdesks.manage — super_admin).
-- =====================================================================

create table if not exists cashdesk_balance_snapshots (
  id bigserial primary key,
  cashdesk_id uuid not null references cashdesks(id) on delete cascade,
  ok boolean not null,
  balance numeric(14,2),
  credit_limit numeric(14,2),
  threshold numeric(14,2),
  is_low boolean not null default false,
  error text,
  taken_at timestamptz not null default now()
);

create index if not exists idx_cashdesk_balance_snapshots_desk_time
  on cashdesk_balance_snapshots(cashdesk_id, taken_at desc);

alter table cashdesk_balance_snapshots enable row level security;

create policy "cashdesk balance snapshots read" on cashdesk_balance_snapshots
  for select using (has_permission('cashdesks.manage'));
