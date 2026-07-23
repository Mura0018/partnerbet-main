-- =====================================================================
--  KOP KASSA — 6-BOSQICH: QARZ MEXANIZMI
--  Band operator (A) o'rniga B takeover qilib buyurtmani bajarsa, pul B
--  kassasidan ketadi -> A qarzdor. Qarz AVTOMATIK yoziladi, ikki tomon
--  tasdiqi bilan yopiladi.
--
--  "Asl owner" = takeover'дан oldingi claimed_by. takeover uni
--  telegram_orders.handoff_from_operator_id ga saqlaydi (takeover
--  bo'lmasa bu ustun bo'sh -> qarz yo'q).
-- =====================================================================

alter table telegram_orders
  add column if not exists handoff_from_operator_id uuid references profiles(id) on delete set null;

create table if not exists operator_debts (
  id uuid primary key default gen_random_uuid(),
  debtor_operator_id uuid references profiles(id) on delete set null,   -- band/asl owner (qarzdor)
  creditor_operator_id uuid references profiles(id) on delete set null, -- o'ringa olgan (haqdor)
  order_id uuid references telegram_orders(id) on delete set null,
  amount numeric(14,2) not null,
  cashdesk_id uuid references cashdesks(id) on delete set null,         -- qaysi kassadan ketdi
  status text not null default 'open' check (status in ('open','debtor_confirmed','creditor_confirmed','paid')),
  debtor_confirmed_at timestamptz,
  creditor_confirmed_at timestamptz,
  escalated_at timestamptz,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_operator_debts_debtor on operator_debts(debtor_operator_id, status);
create index if not exists idx_operator_debts_creditor on operator_debts(creditor_operator_id, status);
create index if not exists idx_operator_debts_status on operator_debts(status, created_at);
-- Bir buyurtma -> bitta qarz (avtomatik yozishда dublikat bo'lmasin)
create unique index if not exists idx_operator_debts_order on operator_debts(order_id);

alter table operator_debts enable row level security;

-- Operator faqat O'Z qarzlarini o'qiydi (qarzdor yoki haqdor). Yozish/tasdiq
-- server (service role) orqali — mantiq API'да.
create policy "operator_debts self read" on operator_debts
  for select using (
    has_permission('telegram_orders.manage')
    and (debtor_operator_id = auth.uid() or creditor_operator_id = auth.uid())
  );

-- Qarz sozlamalari: limit 0 = cheksiz (band qilmaydi), escalation_hours 24.
insert into site_settings (key, value)
values ('cashdesk_debt', '{"limit": 0, "escalation_hours": 24}'::jsonb)
on conflict (key) do nothing;
