-- =====================================================================
--  KASSA BALANSI — 6b: KASSA TO'LDIRUVCHI (FILLER) ROLI
--  - profiles.notify_cashdesk_low — shaxsiy toggle (0052 naqshi)
--  - 'cashdesks.fill' ruxsati — kassa balansini KO'RISH (faqat o'qish)
--  - 'cashdesk_filler' roli — FAQAT 'cashdesks.fill' (boshqa hech narsa)
--  - cashdesk_fillers — qaysi to'ldiruvchi qaysi kassaga mas'ul.
--    Foydalanuvchining birorta qatori bo'lmasa -> BARCHA aktiv kassalar
--    bo'yicha xabar oladi (ilova mantig'i, lib/telegram/notifyLowBalance.ts).
--  - cashdesk_balance_snapshots o'qish policy'si TOR qoladi (faqat
--    cashdesks.manage). To'ldiruvchi sahifasi snapshot'larni server (service
--    role) orqali, faqat o'z kassalari va error/credit_limit'siz o'qiydi —
--    keng policy PostgREST orqali barcha tarixni ochib qo'ygan bo'lardi.
--
--  Qayta ishga tushirishga chidamli: if not exists / on conflict /
--  drop policy if exists.
-- =====================================================================

-- a) Shaxsiy toggle
alter table profiles add column if not exists notify_cashdesk_low boolean not null default true;

-- b) Ruxsat
insert into permissions (key, description)
values ('cashdesks.fill', 'Kassa balansini ko''rish')
on conflict (key) do nothing;

-- d) Rol (c dan oldin — role_permissions unga tayanadi)
insert into roles (key, name, description)
values ('cashdesk_filler', 'Kassa to''ldiruvchi', 'Faqat kassa balansini ko''radi va past balans xabarini oladi')
on conflict (key) do nothing;

-- c) cashdesks.fill -> super_admin VA cashdesk_filler (faqat shu ruxsat)
insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r cross join permissions p
where r.key in ('super_admin', 'cashdesk_filler') and p.key = 'cashdesks.fill'
on conflict (role_id, permission_id) do nothing;

-- e) Biriktirish jadvali
create table if not exists cashdesk_fillers (
  cashdesk_id uuid not null references cashdesks(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (cashdesk_id, user_id)
);

create index if not exists idx_cashdesk_fillers_user on cashdesk_fillers(user_id);

alter table cashdesk_fillers enable row level security;

drop policy if exists "cashdesk fillers manage all" on cashdesk_fillers;
create policy "cashdesk fillers manage all" on cashdesk_fillers
  for all using (has_permission('cashdesks.manage')) with check (has_permission('cashdesks.manage'));

-- f) Snapshot o'qish: FAQAT cashdesks.manage (0101 bilan bir xil, qasddan tor)
drop policy if exists "cashdesk balance snapshots read" on cashdesk_balance_snapshots;
create policy "cashdesk balance snapshots read" on cashdesk_balance_snapshots
  for select using (has_permission('cashdesks.manage'));
