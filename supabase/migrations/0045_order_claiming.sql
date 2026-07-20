-- =========================================================
-- 0045 — ORDER CLAIMING (who's handling what, live)
-- When an operator opens a pending order, it's "claimed" by them so
-- other operators see it's being worked on instead of all piling onto
-- the same order. This is informational/soft — the actual outcome-of-
-- record is still `operator_id` (set on resolve in 0036), which is what
-- gives each operator their permanent history of completed/rejected
-- orders. Claiming just reduces collisions while orders are pending.
-- =========================================================
alter table telegram_orders add column if not exists claimed_by uuid references profiles(id) on delete set null;
alter table telegram_orders add column if not exists claimed_at timestamptz;
