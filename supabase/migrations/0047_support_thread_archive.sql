-- =========================================================
-- 0047 — SUPPORT THREAD ARCHIVE
-- Once an operator has handled a customer's support thread, they archive
-- it — it disappears from the main (active) list and moves to a separate
-- "Arxiv" view for later reference. If the customer sends a new message
-- after that, the thread automatically un-archives (see the customer-
-- facing support POST route), so nothing genuinely new gets missed.
-- =========================================================
create table telegram_support_threads (
  customer_id uuid primary key references customers(id) on delete cascade,
  is_archived boolean not null default false,
  archived_by uuid references profiles(id) on delete set null,
  archived_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table telegram_support_threads enable row level security;
create policy "telegram_orders.manage manage support threads" on telegram_support_threads
  for all
  using (has_permission('telegram_orders.manage'))
  with check (has_permission('telegram_orders.manage'));
