-- =========================================================
-- 0042 — BETCORE PAY: ORDER/DAILY LIMITS
-- Prevents a single mistaken or malicious order from moving an unbounded
-- amount, and caps how much one customer can move through the system per
-- day. Values are admin-editable (Admin > BetCore Pay), defaults below
-- are a starting point, not a business decision baked into code.
-- =========================================================
insert into site_settings (key, value) values
  ('betcore_pay_limits', '{"max_order_amount": 5000000, "daily_customer_limit": 10000000}')
on conflict (key) do nothing;
