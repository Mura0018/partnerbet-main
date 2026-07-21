-- =========================================================
-- 0052 — NOTIFICATION PREFERENCES
-- Lets each staff member toggle order/security Telegram alerts
-- independently, without unlinking Telegram entirely.
-- =========================================================
alter table profiles add column if not exists notify_orders boolean not null default true;
alter table profiles add column if not exists notify_security boolean not null default true;
