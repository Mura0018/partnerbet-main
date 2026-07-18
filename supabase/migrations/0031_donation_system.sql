-- =========================================================
-- 0031 — VERSION 1.2.0: DONATION & SUPPORT SYSTEM
-- Gateway credentials use the same encryption module as Live Streaming
-- (v1.1.0, lib/security/encryption.ts) — no separate security system
-- built for this feature. Crypto wallet addresses are NOT secret (donors
-- must see them to send funds), so they live in plain columns here.
-- =========================================================

insert into permissions (key, description) values
  ('donations.manage', 'Manage payment methods, view donations, export reports');

insert into role_permissions (role_id, permission_id)
select r.id, p.id
from roles r, permissions p
where p.key = 'donations.manage'
  and r.key in ('super_admin', 'admin', 'content_manager');

-- ---------------------------------------------------------------
-- PAYMENT METHODS
-- One table for both payment gateways (Stripe/PayPal/future) and crypto
-- wallets (USDT/BTC/ETH/SOL/future) via `method_type`. Gateway API
-- credentials are NEVER stored here — they live encrypted in
-- api_credentials (keyed 'donation:{payment_method.id}:api_key' etc,
-- same pattern as Live Streaming). Crypto wallet_address is public
-- information by nature (donors must see it), so it's a plain column.
-- ---------------------------------------------------------------
create table payment_methods (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null check (char_length(name) between 1 and 100),
  method_type text not null check (method_type in ('gateway', 'crypto')),

  -- gateway-only fields
  provider_key text check (provider_key in ('stripe', 'paypal', 'generic')),
  base_api_url text,       -- only used when provider_key = 'generic' (Stripe/PayPal have fixed, well-known API hosts)

  -- crypto-only fields
  crypto_symbol text,      -- e.g. 'USDT', 'BTC', 'ETH', 'SOL'
  network text,            -- e.g. 'TRC20', 'ERC20', 'Mainnet'
  wallet_address text,

  display_order int not null default 0,
  is_active boolean not null default true,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint chk_payment_method_shape check (
    (method_type = 'gateway' and provider_key is not null and wallet_address is null)
    or
    (method_type = 'crypto' and wallet_address is not null and provider_key is null)
  )
);
create index idx_payment_methods_active on payment_methods(display_order) where is_active = true and deleted_at is null;

create trigger trg_payment_methods_updated_at before update on payment_methods
  for each row execute function public.set_updated_at();
create trigger trg_audit_payment_methods
  after insert or update or delete on payment_methods
  for each row execute function public.audit_trigger();

alter table payment_methods enable row level security;
-- Public read is safe: no secrets live in this table (gateway keys are
-- elsewhere; wallet addresses are meant to be public).
create policy "public read active payment_methods" on payment_methods
  for select using (is_active = true and deleted_at is null);
create policy "donations.manage full access payment_methods" on payment_methods
  for all using (has_permission('donations.manage')) with check (has_permission('donations.manage'));

-- ---------------------------------------------------------------
-- DONATIONS
-- Fully server-mediated: no public RLS policy at all (not even insert).
-- All creation goes through /api/donations/* route handlers (service-role)
-- so amount limits, message length, and provider dispatch are enforced
-- in exactly one place — see DONATION_SYSTEM.md.
-- ---------------------------------------------------------------
create table donations (
  id uuid primary key default gen_random_uuid(),
  payment_method_id uuid references payment_methods(id) on delete set null,
  amount numeric(12, 2) not null check (amount > 0 and amount <= 1000000),
  currency text not null default 'USD' check (currency in ('USD', 'EUR', 'UZS')),
  donor_name text check (donor_name is null or char_length(donor_name) <= 80),
  donor_email text,
  message text check (message is null or char_length(message) <= 500),
  is_anonymous boolean not null default false,
  is_public boolean not null default true,
  status text not null default 'pending' check (status in ('pending', 'completed', 'failed', 'refunded')),
  external_transaction_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_donations_status on donations(status);
create index idx_donations_public_completed on donations(created_at desc) where status = 'completed' and is_public = true and is_anonymous = false;
create index idx_donations_created_at_brin on donations using brin (created_at);

create trigger trg_donations_updated_at before update on donations
  for each row execute function public.set_updated_at();
create trigger trg_audit_donations
  after insert or update or delete on donations
  for each row execute function public.audit_trigger();

alter table donations enable row level security;
create policy "donations.manage full access donations" on donations
  for all using (has_permission('donations.manage')) with check (has_permission('donations.manage'));
-- No public policy whatsoever — see header note.

-- ---------------------------------------------------------------
-- DONATION WEBHOOK LOG (webhook verification audit trail — every
-- inbound webhook, verified or not, is recorded so a rejected/forged
-- attempt is visible to admins, not silently dropped).
-- ---------------------------------------------------------------
create table donation_webhook_log (
  id uuid primary key default gen_random_uuid(),
  payment_method_id uuid references payment_methods(id) on delete set null,
  verified boolean not null,
  event_type text,
  donation_id uuid references donations(id) on delete set null,
  raw_payload jsonb,
  created_at timestamptz not null default now()
);
create index idx_donation_webhook_log_method on donation_webhook_log(payment_method_id, created_at desc);

alter table donation_webhook_log enable row level security;
create policy "donations.manage read webhook_log" on donation_webhook_log
  for select using (has_permission('donations.manage'));
-- No insert/update/delete policy for anyone — only the webhook route
-- (service-role) writes here.
