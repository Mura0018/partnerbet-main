-- =====================================================================
--  BOSHQARUV MARKAZI — global yoq/och kalitlar (kill-switch).
--  Super admin buyurtma qabulини (to'ldirish/yechish) darhol to'xtata oladi.
--  Standart: ikkаласи YOQ (true). site_settings (settings.manage) orqали.
-- =====================================================================

insert into site_settings (key, value)
values ('betcore_switches', '{"topup": true, "withdraw": true}'::jsonb)
on conflict (key) do nothing;
