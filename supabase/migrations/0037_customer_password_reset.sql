-- =========================================================
-- 0037 — BETCORE PAY: PASSWORD RESET VIA TELEGRAM CODE
-- Customers have no email, so "forgot password" works by sending a
-- one-time numeric code to the customer's linked Telegram chat instead
-- of an email link. The code is bcrypt-hashed at rest (same standard as
-- password_hash) and expires after 10 minutes.
-- =========================================================
alter table customers add column if not exists reset_code_hash text;
alter table customers add column if not exists reset_code_expires_at timestamptz;
