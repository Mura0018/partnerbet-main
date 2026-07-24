-- =====================================================================
--  B6 — HAMKOR THEMA PAYWALL TESHIGINI YOPISH (audit topgan)
--  Muammo: hamkor-admin brauzer konsolидан partners.theme_key ni
--  to'g'ridan-to'g'ri o'zgartirib, premium themani TO'LOVSIZ olardi
--  (RLS ustun-ko'r, mavjud trigger theme_key ni himoyalamasdi).
--
--  Yechim: protect_partner_privileged_cols triggerни kengaytiramiz —
--  mavjud himoya (plan/commission/status/...) O'ZGARMAYDI, faqat
--  theme_key almashuvi tekshiriladi: free (is_premium=false) YOKI
--  partner_theme_access.enabled bo'lgan premium themagagina ruxsat.
--  Aks holda eski qiymatga qaytariladi. Super admin (partners.manage)
--  cheklovsiz (blok umuman ishlamaydi u uchun).
--
--  Bu DB-darajасидаgi yechim — konsol/API to'g'ridan-to'g'ri yozsa ham
--  yopadi (yagona ishonchli joy).
-- =====================================================================

create or replace function public.protect_partner_privileged_cols()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not has_permission('partners.manage') then
    new.plan := old.plan;
    new.commission_pct := old.commission_pct;
    new.subscription_amount := old.subscription_amount;
    new.status := old.status;
    new.billing_model := old.billing_model;
    new.bot_connected := old.bot_connected;

    -- B6: theme_key faqat ruxsat etilgan themaga o'zgarishi mumkin.
    if new.theme_key is distinct from old.theme_key then
      if not exists (
        select 1
        from app_themes t
        left join partner_theme_access a
          on a.theme_id = t.id and a.partner_id = new.id and a.enabled
        where t.key = new.theme_key
          and (t.is_premium = false or a.partner_id is not null)
      ) then
        new.theme_key := old.theme_key;  -- ruxsatsiz premium -> rad etiladi
      end if;
    end if;
  end if;
  return new;
end $$;
