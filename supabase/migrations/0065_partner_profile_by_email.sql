-- =====================================================================
--  App'da "Hamkormisiz?" -> email bo'yicha hamkor a'zosini topish (RPC).
--  security definer: auth.users'dan o'qiydi.
-- =====================================================================
create or replace function public.partner_profile_by_email(p_email text)
returns uuid language sql stable security definer set search_path = public, auth as $f$
  select pm.profile_id
  from partner_members pm
  join auth.users u on u.id = pm.profile_id
  where lower(u.email) = lower(p_email)
  limit 1
$f$;
