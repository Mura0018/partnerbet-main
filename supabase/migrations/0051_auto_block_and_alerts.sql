-- =========================================================
-- 0051 — AUTOMATIC BLOCKING + TEAM SECURITY ALERTS
-- expires_at lets an auto-block self-expire (24h) while a manual block
-- from the security log stays permanent (expires_at null) until someone
-- unblocks it. security_alert_state is a tiny dedup table so a
-- sustained attack sends one Telegram alert per cooldown window instead
-- of one per failed request.
-- =========================================================
alter table blocked_ips add column if not exists expires_at timestamptz;

create table security_alert_state (
  alert_key text primary key,
  last_sent_at timestamptz not null default now()
);
alter table security_alert_state enable row level security;
-- Intentionally no policies — service-role only, same pattern as
-- login_attempts / blocked_ips.
