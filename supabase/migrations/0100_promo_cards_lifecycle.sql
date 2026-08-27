-- =====================================================================
--  QR KASSA — 0-BOSQICH: promo_cards HAYOTIY SIKLI
--  Kartalar oldindan partiya bilan chop etiladi (blank), kassada mijozga
--  biriktiriladi (assigned), yo'qolsa bekor qilinadi (cancelled) — tarix
--  saqlanadi. customer_id endi NULL bo'la oladi (blank kartalar mijozsiz).
--
--  DIQQAT: bu migratsiya JONLI sovrin tizimiga tegadi (promo_cards mavjud
--  self-claim kartalari bilan to'la). Backfill: eski kartalar 'assigned'
--  (default) bo'lib qoladi, hech biri yo'qolmaydi. Reyting/g'olib funksiyalari
--  faqat AKTIV (assigned) kartani hisobga oladigan qilib qayta yoziladi.
-- =====================================================================

-- ---- Hayotiy-sikl ustunlari ----
alter table promo_cards add column if not exists status text not null default 'assigned'
  check (status in ('blank', 'assigned', 'cancelled'));
alter table promo_cards add column if not exists batch_id uuid references card_batches(id) on delete set null;
alter table promo_cards add column if not exists assigned_at timestamptz;
alter table promo_cards add column if not exists cancelled_at timestamptz;
alter table promo_cards add column if not exists assigned_by uuid references profiles(id) on delete set null;
alter table promo_cards add column if not exists cancelled_by uuid references profiles(id) on delete set null;
alter table promo_cards add column if not exists cancel_reason text;

-- customer_id endi NULLABLE (blank kartalar mijozsiz).
alter table promo_cards alter column customer_id drop not null;

-- Eski kartalar allaqachon mijozga tegishli -> assigned_at = claimed_at
-- (status default 'assigned' bo'lgani uchun ular avtomatik 'assigned').
update promo_cards set assigned_at = coalesce(assigned_at, claimed_at)
where customer_id is not null;

-- Eski unique(customer_id) o'rniga: faqat bitta AKTIV karta / mijoz.
-- (Bekor qilingan kartalar tarixda qoladi, yangi karta biriktirilishiga
-- to'sqinlik qilmaydi.) card_code unique O'ZGARMAYDI.
alter table promo_cards drop constraint if exists promo_cards_customer_id_key;
create unique index if not exists uq_promo_cards_active_customer
  on promo_cards(customer_id) where status = 'assigned';
create index if not exists idx_promo_cards_status on promo_cards(status);
create index if not exists idx_promo_cards_batch on promo_cards(batch_id);

-- Blank kartalar mijozsiz o'qilishi uchun (skaner "biriktirilmagan" ko'rsatadi).
-- Amalda barcha o'qish/yozish server (service role) orqali; policy qatlami.
drop policy if exists "promo_cards manage read" on promo_cards;
create policy "promo_cards manage read" on promo_cards
  for select using (has_permission('promo.manage') or has_permission('telegram_orders.manage'));

-- =====================================================================
--  SOVRIN FUNKSIYALARINI QAYTA YOZISH — faqat AKTIV (assigned) karta
--  has_card beradi. Bekor qilingan/blank kartalar hisobga olinmaydi,
--  dublikat qatorlar chiqmaydi. Mantiq boshqa jihatlarda O'ZGARMAYDI.
-- =====================================================================

-- 0079 — umumiy reyting (bitta ro'yxat).
create or replace function public.promo_activity_ranking(p_limit int default 200)
returns json language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(row_to_json(r)), '[]'::json)
  from (
    select
      c.id,
      c.full_name,
      c.phone,
      coalesce(sum(o.amount) filter (where o.status = 'completed'), 0)::numeric as volume,
      count(o.id) filter (where o.status = 'completed') as orders_count,
      (pc.id is not null) as has_card
    from customers c
    left join telegram_orders o on o.customer_id = c.id
    left join promo_cards pc on pc.customer_id = c.id and pc.status = 'assigned'
    group by c.id, c.full_name, c.phone, pc.id
    having coalesce(sum(o.amount) filter (where o.status = 'completed'), 0) > 0
    order by volume desc
    limit p_limit
  ) r
$$;

-- 0081 — davr + segment reytingi (naqd/onlayn).
create or replace function public.promo_activity_ranking_v2(p_start timestamptz, p_end timestamptz)
returns json language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(row_to_json(r)), '[]'::json)
  from (
    select
      c.id, c.full_name, c.phone,
      coalesce(sum(o.amount) filter (
        where o.status = 'completed'
          and (p_start is null or o.created_at >= p_start)
          and (p_end is null or o.created_at < p_end)
      ), 0)::numeric as volume,
      count(o.id) filter (
        where o.status = 'completed'
          and (p_start is null or o.created_at >= p_start)
          and (p_end is null or o.created_at < p_end)
      ) as orders_count,
      exists (select 1 from promo_scans ps where ps.customer_id = c.id) as is_cash,
      exists (select 1 from promo_cards pc where pc.customer_id = c.id and pc.status = 'assigned') as has_card
    from customers c
    left join telegram_orders o on o.customer_id = c.id
    group by c.id, c.full_name, c.phone
    having coalesce(sum(o.amount) filter (
        where o.status = 'completed'
          and (p_start is null or o.created_at >= p_start)
          and (p_end is null or o.created_at < p_end)
      ), 0) > 0
    order by volume desc
    limit 300
  ) r
$$;
