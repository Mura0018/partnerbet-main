-- =========================================================
-- 0053 — FAIR CARD ROTATION, USAGE LIMITS, STALE-CLAIM ALERTS
-- Three related fairness mechanisms for BetCore Pay:
-- 1. usage_count lets payment selection prefer the least-recently-used
--    card instead of pure random, spreading load evenly over time.
-- 2. usage_limit lets an operator cap how many times a card gets shown
--    before the system retires it and asks them to add a replacement.
-- 3. claim_escalated_at prevents the stale-claim cron (see
--    /api/cron/check-stale-claims) from posting the same "operator
--    isn't responding" nudge to the team chat more than once per order.
-- =========================================================
alter table telegram_operator_payment_methods add column if not exists usage_count int not null default 0;
alter table telegram_operator_payment_methods add column if not exists usage_limit int;

alter table telegram_orders add column if not exists claim_escalated_at timestamptz;
