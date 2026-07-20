-- =========================================================
-- 0039 — TOP-UP RECEIPTS + WITHDRAW RECIPIENT NAME
-- Top-up orders now require a payment receipt screenshot (uploaded to a
-- PRIVATE bucket — these are financial screenshots, not public media).
-- No RLS policy is added for anon/authenticated: upload happens via the
-- service-role client in /api/telegram/miniapp/orders/receipt, and staff
-- view happens via a short-lived signed URL generated server-side in
-- /api/admin/telegram-orders/receipt-url — neither path needs a client-
-- facing policy, same "service role only" trust boundary as `customers`.
-- =========================================================
alter table telegram_orders add column if not exists receipt_path text;
alter table telegram_orders add column if not exists recipient_name text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 5242880, array['image/png','image/jpeg','image/webp'])
on conflict (id) do nothing;
