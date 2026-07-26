-- =========================================================
-- W1.3 — BUYURTMA MUDDATI (expired) VA ABANDON ANIQLASH
-- Pending buyurtma site_settings.betcore_abandon_settings.order_expiry_min
-- (standart 30 daq.) dan uzoq tursa -> status='expired' (cron:
-- /api/cron/expire-stale-orders — W1.3 alohida yozadi). Ketma-ket
-- abandon_streak_limit (standart 3) ta expired -> mijozga yangi buyurtma
-- ochish block_duration_min (standart 60 daq.) ga yopiladi. Mijoz
-- BIRON buyurtmani muvaffaqiyatli yakunlasa (completed) -> streak nolga.
-- Sonlar KODGA QATTIQ YOZILMAGAN — site_settings'dan o'qiladi.
-- =========================================================

alter table telegram_orders drop constraint if exists telegram_orders_status_check;
alter table telegram_orders add constraint chk_status_values
  check (status in ('pending', 'completed', 'rejected', 'expired'));

alter table telegram_orders add column if not exists expired_at timestamptz;

alter table customers add column if not exists abandoned_streak int not null default 0;
alter table customers add column if not exists blocked_until timestamptz;

insert into site_settings (key, value)
values (
  'betcore_abandon_settings',
  jsonb_build_object(
    'order_expiry_min', 30,
    'abandon_streak_limit', 3,
    'block_duration_min', 60
  )
)
on conflict (key) do nothing;
