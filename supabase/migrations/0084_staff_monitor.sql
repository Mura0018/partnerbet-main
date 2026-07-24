-- =====================================================================
--  XODIMLAR NAZORATI — har operator (telegram_orders.manage) bo'yicha
--  yig'ma statistika (server-tomon agregatsiya). Kirish (login) va email
--  API tomonда (auth.users + login_attempts) qo'shiladi. operators.oversight
--  (super_admin) ko'radi.
-- =====================================================================

create or replace function public.staff_monitor()
returns json language sql stable security definer set search_path = public as $$
  with ops as (
    select p.id,
           coalesce(p.display_name, p.full_name, 'Operator') as name,
           p.is_online, p.is_busy, coalesce(p.rating, 0) as rating
    from profiles p
    where p.is_active
      and p.role_id in (
        select rp.role_id from role_permissions rp
        join permissions pm on pm.id = rp.permission_id
        where pm.key = 'telegram_orders.manage'
      )
  )
  select coalesce(json_agg(row_to_json(r)), '[]'::json)
  from (
    select
      o.id, o.name, o.is_online, o.is_busy, o.rating,
      (select count(*) from telegram_orders t where t.operator_id = o.id and t.status = 'completed') as completed,
      (select count(*) from telegram_orders t where t.operator_id = o.id and t.status = 'rejected') as rejected,
      (select coalesce(sum(amount), 0) from telegram_orders t where t.operator_id = o.id and t.status = 'completed')::numeric as volume,
      (select count(*) from operator_alerts a where a.operator_id = o.id) as alerts,
      (select coalesce(sum(amount), 0) from operator_debts d where d.debtor_operator_id = o.id and d.status <> 'paid')::numeric as open_debt,
      (select count(*) from promo_scans s where s.scanned_by = o.id) as scans
    from ops o
    order by o.rating asc
  ) r
$$;
