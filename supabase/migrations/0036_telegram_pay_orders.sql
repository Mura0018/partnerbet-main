-- =========================================================
-- 0036 — BETCORE PAY: TOP-UP/WITHDRAW ORDERS + SUPPORT CHAT
-- 1xBet (and other platforms) have no public API yet, so this is a fully
-- manual/operator-mediated flow: the customer submits an order in the
-- Mini App, an operator verifies the payment/withdrawal off-platform
-- (Click/Payme/card/crypto transfer, or the platform's own cashier), then
-- marks the order completed or rejected here. The customer is notified
-- via the Telegram bot either way.
--
-- Region-based operator routing (`region` column) is stored but NOT yet
-- enforced by RLS — today there is a single operator, so any staff
-- account with `telegram_orders.manage` sees every order. When multiple
-- regional kassas are introduced, tighten the SELECT policy below to also
-- match profiles.telegram_region for non-admin roles.
-- =========================================================

-- ---------------------------------------------------------------
-- SECURITY FIX: `customers` (0033) was created with RLS never enabled —
-- meaning phone numbers and password_hash were reachable by anon/
-- authenticated PostgREST requests with no policy blocking them at all.
-- Every customer read/write already goes through service-role API routes
-- (register/login/session), so locking this down breaks nothing.
-- ---------------------------------------------------------------
alter table customers enable row level security;
-- Staff with telegram_orders.manage need to see who an order/support
-- thread belongs to (phone, name) — this is the one exception to "service
-- role only". It's read-only and row-level (no insert/update/delete for
-- anyone but service role), same trust boundary staff already have via
-- Foydalanuvchilar/Donations/etc.
create policy "telegram_orders.manage read customers" on customers
  for select using (has_permission('telegram_orders.manage'));

create table telegram_orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  type text not null check (type in ('topup', 'withdraw')),
  platform text not null check (char_length(platform) between 1 and 50),
  account_id text not null check (char_length(account_id) between 1 and 50),
  amount numeric(14,2) not null check (amount > 0),
  payment_method text not null check (payment_method in ('click', 'payme', 'card', 'crypto')),
  withdraw_code text check (withdraw_code is null or char_length(withdraw_code) <= 20),
  payout_details text check (payout_details is null or char_length(payout_details) <= 500),
  status text not null default 'pending' check (status in ('pending', 'completed', 'rejected')),
  operator_id uuid references profiles(id) on delete set null,
  operator_note text check (operator_note is null or char_length(operator_note) <= 500),
  region text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint chk_withdraw_code_required check (
    (type = 'withdraw' and withdraw_code is not null) or type = 'topup'
  )
);
create index idx_telegram_orders_customer on telegram_orders(customer_id);
create index idx_telegram_orders_status on telegram_orders(status);
create index idx_telegram_orders_created on telegram_orders(created_at desc);

create trigger trg_telegram_orders_updated_at before update on telegram_orders
  for each row execute function public.set_updated_at();
create trigger trg_audit_telegram_orders
  after insert or update or delete on telegram_orders
  for each row execute function public.audit_trigger();

alter table telegram_orders enable row level security;
-- No public policy at all: every customer-facing read/write goes through
-- /api/telegram/miniapp/orders (service-role client, initData-verified),
-- same pattern as the customers table itself.
create policy "telegram_orders.manage full access" on telegram_orders
  for all using (has_permission('telegram_orders.manage')) with check (has_permission('telegram_orders.manage'));

-- ---------------------------------------------------------------
-- SUPPORT CHAT (customer <-> operator, inside the Mini App)
-- ---------------------------------------------------------------
create table telegram_support_messages (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  sender text not null check (sender in ('customer', 'operator')),
  operator_id uuid references profiles(id) on delete set null,
  message text not null check (char_length(message) between 1 and 2000),
  created_at timestamptz not null default now(),

  constraint chk_operator_id_shape check (
    (sender = 'operator' and operator_id is not null) or sender = 'customer'
  )
);
create index idx_telegram_support_customer on telegram_support_messages(customer_id, created_at);

alter table telegram_support_messages enable row level security;
-- Customer side goes through /api/telegram/miniapp/support/* (service-role,
-- initData-verified). Staff read everything and reply as themselves.
create policy "telegram_orders.manage read support messages" on telegram_support_messages
  for select using (has_permission('telegram_orders.manage'));
create policy "telegram_orders.manage reply as operator" on telegram_support_messages
  for insert with check (
    has_permission('telegram_orders.manage') and sender = 'operator' and operator_id = auth.uid()
  );

-- ---------------------------------------------------------------
-- PAYMENT DETAILS shown to the customer when they pick a top-up method
-- (Click/Payme/card/crypto). Public read like every other site_settings
-- row (see 0014) — these are meant to be seen, not secret. Edited from
-- Admin > BetCore Pay > To'lov ma'lumotlari (settings.manage).
-- ---------------------------------------------------------------
insert into site_settings (key, value) values
  ('betcore_pay_payment_info', '{"card_number": "", "click_number": "", "payme_number": "", "crypto_wallet": ""}');
