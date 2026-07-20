-- =========================================================
-- 0049 — TRACK WHICH OPERATOR'S PAYMENT DETAILS A TOPUP WENT TO
-- Fixes a real gap: multiple operators can each have their own card/
-- Click/Payme, and one is picked at random to show the customer — but
-- until now nothing recorded WHICH one, so whoever resolves the order
-- (not necessarily the operator who owns that card) had no way to know
-- where the money actually landed.
-- =========================================================
alter table telegram_orders add column if not exists payment_operator_id uuid references profiles(id) on delete set null;
alter table telegram_orders add column if not exists received_account_number text;
alter table telegram_orders add column if not exists received_holder_name text;
