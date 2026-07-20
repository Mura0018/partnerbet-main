-- =========================================================
-- 0040 — PER-OPERATOR PAYMENT METHODS
-- Replaces the single global "betcore_pay_payment_info" site_settings row:
-- each operator now maintains their OWN card/Click/Payme/crypto details
-- (with the account holder's full name). When a customer opens the
-- top-up screen, one active entry per method type is picked at random
-- among all operators who have that type configured — this is what
-- spreads incoming payments across operators instead of concentrating
-- them on one person's account.
-- =========================================================
create table telegram_operator_payment_methods (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid not null references profiles(id) on delete cascade,
  method_type text not null check (method_type in ('card', 'click', 'payme', 'crypto')),
  account_number text not null check (char_length(account_number) between 1 and 100),
  holder_name text check (holder_name is null or char_length(holder_name) <= 150),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_operator_payment_methods_active on telegram_operator_payment_methods(method_type) where is_active = true;

create trigger trg_operator_payment_methods_updated_at before update on telegram_operator_payment_methods
  for each row execute function public.set_updated_at();

alter table telegram_operator_payment_methods enable row level security;
-- Every operator manages only their own rows.
create policy "operators manage own payment methods" on telegram_operator_payment_methods
  for all
  using (operator_id = auth.uid() and has_permission('telegram_orders.manage'))
  with check (operator_id = auth.uid() and has_permission('telegram_orders.manage'));
-- Admin/super_admin can see everyone's for oversight (read-only — they
-- don't edit someone else's payment details).
create policy "telegram_operators.manage read all payment methods" on telegram_operator_payment_methods
  for select using (has_permission('telegram_operators.manage'));
