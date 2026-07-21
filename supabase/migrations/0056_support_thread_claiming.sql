-- =========================================================
-- 0056 — SUPPORT THREAD CLAIMING
-- Mirrors order claiming (0045): whoever opens/replies to a customer's
-- support thread first "claims" it, so it's always clear which operator
-- is handling that conversation — no more than one person answering the
-- same customer at once, and no confusion about whose job it is.
-- =========================================================
alter table telegram_support_threads add column if not exists claimed_by uuid references profiles(id) on delete set null;
alter table telegram_support_threads add column if not exists claimed_at timestamptz;
