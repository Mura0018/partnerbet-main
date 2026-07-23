-- =====================================================================
--  KOP KASSA — 4-BOSQICH: STATUS + SLA + HANDOFF + LOCK
--  claimed_by MAVJUD lock/tayinlash vazifasini bajaradi (locked_by
--  qo'shilmaydi). Bu migratsiya faqat qo'shadi:
--   - profiles.is_busy / busy_reason (operator band holati, is_online dan alohida)
--   - telegram_orders.sla_deadline (owner javob berish muddati)
--   - telegram_orders.handoff_open (SLA o'tsa/band bo'lsa -> boshqa operator olishi mumkin)
--   - site_settings.cashdesk_sla ({minutes}) — standart 5, sozlanadi.
-- =====================================================================

-- Operator band holati (is_online = onlayn/oflayn; is_busy = band/bo'sh + sabab)
alter table profiles add column if not exists is_busy boolean not null default false;
alter table profiles add column if not exists busy_reason text;

-- SLA + handoff (claimed_by = lock, qo'shimcha ustunlar shart emas)
alter table telegram_orders add column if not exists sla_deadline timestamptz;
alter table telegram_orders add column if not exists handoff_open boolean not null default false;

create index if not exists idx_orders_sla on telegram_orders(status, sla_deadline);
create index if not exists idx_orders_handoff on telegram_orders(handoff_open) where handoff_open;

-- SLA daqiqasi (sozlanadi, standart 5)
insert into site_settings (key, value)
values ('cashdesk_sla', '{"minutes": 5}'::jsonb)
on conflict (key) do nothing;
