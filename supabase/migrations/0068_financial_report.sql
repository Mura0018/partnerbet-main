-- =====================================================================
--  MOLIYAVIY HISOBOT — komissiya foizlari (tahrirlanadi) + reports.view
--  ruxsati + server-tomon agregatsiya RPC (katta ma'lumot uchun).
-- =====================================================================

-- 1) Komissiya foizlari (site_settings — tahrirlanadi)
insert into site_settings (key, value)
values ('betcore_commission', '{"topup_pct": 8, "withdraw_pct": 2}'::jsonb)
on conflict (key) do nothing;

-- 2) reports.view ruxsati -> faqat super_admin
insert into permissions (key, description)
values ('reports.view', 'Moliyaviy hisobotlar')
on conflict (key) do nothing;

insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r cross join permissions p
where r.key = 'super_admin' and p.key = 'reports.view'
on conflict (role_id, permission_id) do nothing;

-- 3) Agregatsiya RPC — davr bo'yicha SUM/COUNT/GROUP BY (server tomonda).
create or replace function public.betcore_financial_report(p_start timestamptz, p_end timestamptz)
returns json language sql stable security definer set search_path = public as $$
  with completed as (
    select amount, type, partner_id, payment_method, operator_id, created_at
    from telegram_orders
    where status = 'completed' and created_at >= p_start and created_at < p_end
  ), allrows as (
    select status from telegram_orders where created_at >= p_start and created_at < p_end
  )
  select json_build_object(
    'topup_volume',    coalesce((select sum(amount) from completed where type='topup'),0),
    'withdraw_volume', coalesce((select sum(amount) from completed where type='withdraw'),0),
    'completed_count', (select count(*) from allrows where status='completed'),
    'rejected_count',  (select count(*) from allrows where status='rejected'),
    'pending_count',   (select count(*) from allrows where status='pending'),
    'by_partner', coalesce((select json_agg(json_build_object(
        'partner_id', partner_id, 'topup_vol', tv, 'withdraw_vol', wv, 'cnt', cnt)) from (
        select partner_id,
          coalesce(sum(amount) filter (where type='topup'),0)::numeric as tv,
          coalesce(sum(amount) filter (where type='withdraw'),0)::numeric as wv,
          count(*) as cnt
        from completed group by partner_id) q),'[]'::json),
    'by_payment', coalesce((select json_agg(json_build_object(
        'payment_method', payment_method, 'topup_vol', tv, 'withdraw_vol', wv, 'cnt', cnt)) from (
        select payment_method,
          coalesce(sum(amount) filter (where type='topup'),0)::numeric as tv,
          coalesce(sum(amount) filter (where type='withdraw'),0)::numeric as wv,
          count(*) as cnt
        from completed group by payment_method) q),'[]'::json),
    'by_operator', coalesce((select json_agg(json_build_object(
        'operator_id', operator_id, 'cnt', cnt, 'vol', vol)) from (
        select operator_id, count(*) as cnt, coalesce(sum(amount),0)::numeric as vol
        from completed where operator_id is not null group by operator_id) q),'[]'::json),
    'daily', coalesce((select json_agg(json_build_object(
        'day', d, 'topup_vol', tv, 'withdraw_vol', wv) order by d) from (
        select to_char(date_trunc('day', created_at),'YYYY-MM-DD') as d,
          coalesce(sum(amount) filter (where type='topup'),0)::numeric as tv,
          coalesce(sum(amount) filter (where type='withdraw'),0)::numeric as wv
        from completed group by date_trunc('day', created_at)) q),'[]'::json)
  )
$$;
