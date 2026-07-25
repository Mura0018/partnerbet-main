-- =====================================================================
--  site_settings.timezone — server-tomon "bugun"/"shu oy" chegarasi uchun
--  vaqt mintaqasi. Ilgari kod UTC bilan hisoblardi (Toshkentda bu ertalab
--  05:00 da yangilanardi). Standart "Asia/Tashkent" — kelajakda boshqa
--  davlat qo'shilsa, shu qatorni admin panelda o'zgartirish kifoya
--  (lib/site/timezone.ts kodga qattiq yozmaydi).
-- =====================================================================

insert into site_settings (key, value)
values ('timezone', '{"tz": "Asia/Tashkent"}'::jsonb)
on conflict (key) do nothing;
