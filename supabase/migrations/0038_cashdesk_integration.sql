-- =========================================================
-- 0038 — CASHDESK API INTEGRATION (1xBet partner API)
-- Adds columns to cache the player name/currency looked up at order
-- creation time (so operators see who they're paying without a second
-- lookup), and flags whether an order was auto-processed by the real
-- Deposit/Payout API vs handled manually (credentials not configured).
-- =========================================================
alter table telegram_orders add column if not exists player_name text;
alter table telegram_orders add column if not exists currency_id text;
alter table telegram_orders add column if not exists auto_processed boolean not null default false;
