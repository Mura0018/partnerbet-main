-- =====================================================================
--  B7 (D) — AKSIYA BOSHQARUVI: g'oliblar + davr/segment reyting
--  Naqd = kamida bir marta QR skanerlangan (promo_scans bor); onlayn = yo'q.
--  G'olibни admin QO'LDA tasdiqlaydi (promo.manage). Aksiya davri va naqd
--  koeffitsiyenti (1.5x) site_settings.promo jsonb da (page yozadi).
-- =====================================================================

create table if not exists promo_winners (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id) on delete cascade,
  segment text not null check (segment in ('cash', 'online')),
  place int not null check (place between 1 and 10),
  note text,
  confirmed_by uuid references profiles(id) on delete set null,
  confirmed_at timestamptz not null default now(),
  unique (segment, place)
);

alter table promo_winners enable row level security;
create policy "promo_winners manage" on promo_winners
  for all using (has_permission('promo.manage')) with check (has_permission('promo.manage'));

-- Davr + segment reytingi. Naqd = promo_scans bor. Faollik = davrда bajarilgan
-- buyurtmalar summasi. p_start/p_end null bo'lsa butun vaqt.
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
      exists (select 1 from promo_cards pc where pc.customer_id = c.id) as has_card
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
