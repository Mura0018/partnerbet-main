-- =====================================================================
--  QR KASSA — 0-BOSQICH (A): MIJOZ ↔ 1xBET ID MODELI
--  Ilgari 1xBet ID faqat telegram_orders.account_id da edi — "shu mijozning
--  ID'lari" ro'yxati yo'q edi. Endi har mijoz bir nechta ID ga ega bo'la
--  oladi (bittasi asosiy), ism-familiya keshlanadi (findCashdeskPlayer
--  natijasi), va karta yo'qolsa ham mijoz ID orqali topiladi.
--
--  YAGONALIK QARORI (A): unique(customer_id, player_id) — mijoz bo'yicha.
--  Bir ID ni ikki mijoz ishlatishi mumkin ("do'stga to'ldirish" real holat);
--  teskari qidiruv player_id indeksi bilan (odatda 1 ta natija).
--
--  TASDIQLASH: buyurtmadagi ID har doim ham mijozning O'ZINIKI emas, shuning
--  uchun manba (source) va tasdiq (verified) belgilari bor. Backfill qatorlari
--  source='backfill', verified=false -> operator ekranda "taxmin qilingan,
--  tasdiqlang" ko'radi (taxmin fakt bo'lib qolmaydi).
-- =====================================================================
create table customer_bet_accounts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  player_id text not null,                 -- 1xBet/kassa hisob ID (account_id)
  player_name text,                         -- findCashdeskPlayer keshi
  currency_id text,                         -- kesh (ixtiyoriy)
  name_checked_at timestamptz,              -- kesh qachon yangilandi
  is_primary boolean not null default false,
  source text not null default 'operator'
    check (source in ('backfill', 'operator', 'customer')),
  verified boolean not null default false,  -- operator tasdiqlaganmi
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (customer_id, player_id)           -- QAROR (A): mijoz bo'yicha
);
create index idx_cba_customer on customer_bet_accounts(customer_id);
create index idx_cba_player on customer_bet_accounts(player_id);           -- teskari qidiruv (ID -> mijoz)
create unique index uq_cba_primary on customer_bet_accounts(customer_id) where is_primary; -- 1 ta asosiy

alter table customer_bet_accounts enable row level security;
-- Operator o'qiydi; yozish faqat server (service role) orqali (client
-- insert/update/delete policy YO'Q). Operator UI phase 1'da API bilan.
create policy "cba read" on customer_bet_accounts
  for select using (has_permission('telegram_orders.manage'));
create trigger trg_cba_updated_at before update on customer_bet_accounts
  for each row execute function public.set_updated_at();

-- =====================================================================
--  BACKFILL — mavjud buyurtmalardan mijoz-ID bog'lanishini TIKLASH.
--  Har (customer_id, account_id) juftligi -> bitta qator. player_name eng
--  so'nggi non-null qiymat (0038 keshi). source='backfill', verified=false
--  (TAXMIN — operator tasdiqlaydi). Qayta ishga tushirilsa xavfsiz
--  (on conflict do nothing).
-- =====================================================================
insert into customer_bet_accounts (customer_id, player_id, player_name, source, verified, created_at)
select
  o.customer_id,
  o.account_id,
  (array_agg(o.player_name order by o.created_at desc) filter (where o.player_name is not null))[1],
  'backfill',
  false,
  min(o.created_at)
from telegram_orders o
where o.account_id is not null and char_length(o.account_id) between 1 and 50
group by o.customer_id, o.account_id
on conflict (customer_id, player_id) do nothing;

-- Har mijozda eng ko'p buyurtmali ID -> asosiy (is_primary). Teng bo'lsa
-- eng eski. Bu ham TAXMIN (verified emas) — operator kerak bo'lsa o'zgartiradi.
with ranked as (
  select cba.id, row_number() over (
    partition by cba.customer_id
    order by (
      select count(*) from telegram_orders o
      where o.customer_id = cba.customer_id and o.account_id = cba.player_id
    ) desc, cba.created_at asc
  ) as rn
  from customer_bet_accounts cba
)
update customer_bet_accounts c set is_primary = true
from ranked r
where r.id = c.id and r.rn = 1;
