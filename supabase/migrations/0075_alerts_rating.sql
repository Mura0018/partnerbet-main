-- =====================================================================
--  KOP KASSA — 7-BOSQICH: DARAJALI ALERT + OPERATOR REYTINGI
-- =====================================================================

-- A) DARAJALI ALERT
create table if not exists operator_alerts (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid references profiles(id) on delete cascade,
  order_id uuid references telegram_orders(id) on delete set null,
  level int not null check (level in (1, 2, 3)),
  reason text,
  created_at timestamptz not null default now()
);
create index if not exists idx_operator_alerts_op on operator_alerts(operator_id, created_at);
create index if not exists idx_operator_alerts_level on operator_alerts(operator_id, level, created_at);

alter table operator_alerts enable row level security;
-- Operator nazorati (super_admin) o'qiydi. Yozish server (cron/service role).
create policy "operator_alerts read" on operator_alerts
  for select using (has_permission('operators.oversight'));

-- B) OPERATOR REYTINGI
create table if not exists operator_rating_events (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid references profiles(id) on delete cascade,
  order_id uuid references telegram_orders(id) on delete set null,
  delta int not null,
  reason text,
  created_at timestamptz not null default now()
);
create index if not exists idx_rating_events_op on operator_rating_events(operator_id, created_at);

alter table operator_rating_events enable row level security;
create policy "operator_rating_events read" on operator_rating_events
  for select using (has_permission('operators.oversight'));

-- Joriy reyting (cache — tez o'qish uchun)
alter table profiles add column if not exists rating int not null default 0;

-- ATOMIK reyting: hodisa yoziladi + profiles.rating += delta (bitta funksiya,
-- update += poyga xavfsiz).
create or replace function public.apply_operator_rating(p_operator uuid, p_delta int, p_order uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_operator is null then return; end if;
  insert into operator_rating_events(operator_id, order_id, delta, reason) values (p_operator, p_order, p_delta, p_reason);
  update profiles set rating = coalesce(rating, 0) + p_delta where id = p_operator;
end;
$$;

-- Operator nazorati ruxsati -> super_admin
insert into permissions (key, description)
values ('operators.oversight', 'Operator nazorati (alert va reyting)')
on conflict (key) do nothing;

insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r cross join permissions p
where r.key = 'super_admin' and p.key = 'operators.oversight'
on conflict (role_id, permission_id) do nothing;

-- Alert darajalari chegaralari (sozlanadi)
insert into site_settings (key, value)
values ('cashdesk_alert', '{"level2": 3, "level3": 5, "window_hours": 24}'::jsonb)
on conflict (key) do nothing;
