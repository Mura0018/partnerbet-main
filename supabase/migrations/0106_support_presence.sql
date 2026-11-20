-- =====================================================================
--  0106 — ONLAYN HOLAT (heartbeat)
--
--  profiles.is_online ni faqat qo'lda bosiladigan tugma yozardi — tab
--  yopilsa ham operator "onlayn" qolardi. Endi "haqiqiy onlayn" =
--  is_online = true VA last_seen_at oxirgi N daqiqa ichida (standart 4).
--  last_seen_at bo'sh -> OFFLINE (joriy qilinganda hamma onlayn ko'rinmasin).
--
--  last_seen_at ni FAQAT server (service role, /api/admin/shell 30 s
--  polling) yozadi. Brauzerdan yozilsa operator kelajak vaqtni qo'yib abadiy
--  onlayn bo'lib qolardi — shuning uchun 0103 ustun-qo'riqchi trigger'i
--  kengaytirildi: foydalanuvchi sessiyasidan kelgan yozuvda last_seen_at
--  eski qiymatiga qaytariladi.
--
--  Qayta ishga tushirishga chidamli.
--  DEPLOY TARTIBI: istalgan tartib xavfsiz (kod ustun yo'qligini sezib eski
--  is_online ga qaytadi). Tavsiya: avval migratsiya, keyin kod.
-- =====================================================================

alter table profiles add column if not exists last_seen_at timestamptz;

-- 0103 dagi trigger funksiyasi + last_seen_at (foydalanuvchi o'zgartira olmaydi).
create or replace function public.guard_profile_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new; -- service role yoki SQL editor
  end if;

  new.role_id := old.role_id;
  new.rating := old.rating;
  new.telegram_chat_id := old.telegram_chat_id;
  new.telegram_link_code := old.telegram_link_code;
  new.telegram_link_code_expires_at := old.telegram_link_code_expires_at;
  new.created_at := old.created_at;
  new.last_login_at := old.last_login_at;
  new.last_seen_at := old.last_seen_at;

  if new.id = auth.uid() then
    new.is_active := old.is_active;
    new.telegram_region := old.telegram_region;
  end if;

  return new;
end;
$$;

-- SQL tomonidagi yagona ta'rif (lib/presence.ts dagi isEffectivelyOnline bilan
-- bir xil mantiq). N o'zgarsa — shu funksiyaning standart qiymati va
-- NEXT_PUBLIC_PRESENCE_ONLINE_MINUTES birga o'zgartiriladi.
create or replace function public.is_effectively_online(p_is_online boolean, p_last_seen timestamptz, p_minutes int default 4)
returns boolean
language sql
immutable
as $$
  select coalesce(p_is_online, false)
     and p_last_seen is not null
     and p_last_seen > now() - make_interval(mins => p_minutes);
$$;

-- Xodimlar nazorati RPC (0084): is_online endi haqiqiy holat. Qolgan
-- hisob-kitob AYNAN 0084 dagidek.
create or replace function public.staff_monitor()
returns json language sql stable security definer set search_path = public as $$
  with ops as (
    select p.id,
           coalesce(p.display_name, p.full_name, 'Operator') as name,
           public.is_effectively_online(p.is_online, p.last_seen_at) as is_online,
           p.is_busy, coalesce(p.rating, 0) as rating
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
