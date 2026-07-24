-- =====================================================================
--  B7 (A) — SOVRINLI KARTA POYDEVORI
--  Har mijoz bir marta karta oladi (promo_cards). Faollik = bajarilgan
--  buyurtmalar summasi + soni. Saralash: bitta umumiy reyting (naqd/onlayn
--  ajratma HOZIRCHA yo'q — u D-bosqichда). promo.manage = super_admin.
-- =====================================================================

-- Mijozning sovrin kartasi (bir marta olinadi)
create table if not exists promo_cards (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null unique references customers(id) on delete cascade,
  card_code text not null unique,
  claimed_at timestamptz not null default now()
);
create index if not exists idx_promo_cards_customer on promo_cards(customer_id);

alter table promo_cards enable row level security;
-- Server (service role) yozadi/o'qiydi; promo.manage o'qiy oladi.
create policy "promo_cards manage read" on promo_cards
  for select using (has_permission('promo.manage'));

-- promo.manage ruxsati -> super_admin
insert into permissions (key, description)
values ('promo.manage', 'Sovrinli karta / aksiya boshqaruvi')
on conflict (key) do nothing;

insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r cross join permissions p
where r.key = 'super_admin' and p.key = 'promo.manage'
on conflict (role_id, permission_id) do nothing;

-- Aksiya yoq/och (standart O'CHIQ — super admin yoqadi). Aksiya muddati/sovrin
-- D-bosqichда shu jsonb ga qo'shiladi.
insert into site_settings (key, value)
values ('promo', '{"enabled": false}'::jsonb)
on conflict (key) do nothing;

-- Faollik reytingi (server-tomon agregatsiya). Bajarilgan buyurtmalar
-- summasi bo'yicha, faqat faol mijozlar (volume > 0).
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
    left join promo_cards pc on pc.customer_id = c.id
    group by c.id, c.full_name, c.phone, pc.id
    having coalesce(sum(o.amount) filter (where o.status = 'completed'), 0) > 0
    order by volume desc
    limit p_limit
  ) r
$$;
