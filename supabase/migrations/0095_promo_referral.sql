-- =====================================================================
--  0095 — MURAWIN PROMO KODI (referral)
--  Mijoz app'da bosh ekran + Bonus bo'limida ko'rsatiladigan promo kod.
--  Yagona manba: site_settings 'promo_referral' kaliti (JSONB).
--  Yangi jadval YO'Q — mavjud key/value store ishlatiladi (0014).
--  RLS: site_settings da allaqachon "public read" + "settings.manage"
--  siyosatlari bor; qo'shimcha siyosat kerak emas.
--  Boshqaruv API guard'i: promo.manage (aksiya sozlamasi bilan bir xil).
-- =====================================================================

-- Neytral standart qator (aksiya O'CHIQ, kod bo'sh). Admin panel yoqadi/
-- to'ldiradi. on conflict do nothing — mavjud bo'lsa tegilmaydi.
insert into site_settings (key, value)
values (
  'promo_referral',
  '{"enabled": false, "code": "", "description": "", "link": "", "expires_at": null}'::jsonb
)
on conflict (key) do nothing;
