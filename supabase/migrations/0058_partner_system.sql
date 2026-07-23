-- =====================================================================
--  BETCORE PAY — HAMKOR (PARTNER) TIZIMI — Bosqich 1 poydevor
--  Supabase SQL Editor'da bir marta ishga tushiring.
--  Faqat YANGI jadvallar qo'shadi — mavjud jadvallarga tegmaydi.
-- =====================================================================

-- ---------- 1) HAMKOR (tenant/ijara) ----------
create table if not exists partners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  status text not null default 'active' check (status in ('active','suspended','pending')),
  billing_model text not null default 'commission' check (billing_model in ('commission','subscription')),
  commission_pct numeric(5,2) not null default 0,        -- komissiya foizi (%)
  subscription_amount numeric(14,2) not null default 0,  -- obuna to'lovi
  currency text not null default 'UZS',                  -- hohlagan valyuta
  company text,                                          -- masalan: '1xbet'
  contact text,
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_partners_updated_at before update on partners
  for each row execute function public.set_updated_at();

-- ---------- 2) HAMKOR A'ZOLARI (partner_admin + xodimlar) ----------
create table if not exists partner_members (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references partners(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  partner_role text not null default 'staff' check (partner_role in ('partner_admin','staff')),
  created_at timestamptz not null default now(),
  unique (profile_id)   -- bir foydalanuvchi faqat bitta hamkorga tegishli
);
create index if not exists idx_partner_members_partner on partner_members(partner_id);

-- ---------- 3) HAMKOR API MA'LUMOTLARI (o'z 1xbet/kassa API'lari) — MAXFIY ----------
create table if not exists partner_api_credentials (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references partners(id) on delete cascade,
  provider text not null,                       -- '1xbet', 'cashdesk', ...
  credentials jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_partner_api_partner on partner_api_credentials(partner_id);
create trigger trg_partner_api_updated_at before update on partner_api_credentials
  for each row execute function public.set_updated_at();

-- ---------- 4) HAMKOR ICHKI CHATI ----------
create table if not exists partner_chat_messages (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references partners(id) on delete cascade,
  sender_id uuid references profiles(id) on delete set null,
  message text not null,
  is_system boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_partner_chat_partner_time on partner_chat_messages(partner_id, created_at);

-- ---------- 5) GLOBAL CHAT (barcha hamkorlar + platforma) ----------
create table if not exists global_chat_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid references profiles(id) on delete set null,
  partner_id uuid references partners(id) on delete set null,  -- kim nomidan
  message text not null,
  is_system boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_global_chat_time on global_chat_messages(created_at);

-- =====================================================================
--  YORDAMCHI FUNKSIYALAR (RLS uchun)
-- =====================================================================
create or replace function public.current_partner_id()
returns uuid language sql stable as $$
  select partner_id from partner_members where profile_id = auth.uid() limit 1;
$$;

create or replace function public.is_partner_admin()
returns boolean language sql stable as $$
  select exists (
    select 1 from partner_members
    where profile_id = auth.uid() and partner_role = 'partner_admin'
  );
$$;

-- =====================================================================
--  PLATFORMA RUXSATI: 'partners.manage' -> super_admin
-- =====================================================================
insert into permissions (key, description)
values ('partners.manage', 'Hamkorlarni (partner) boshqarish')
on conflict (key) do nothing;

insert into role_permissions (role_id, permission_id)
select r.id, p.id
from roles r cross join permissions p
where r.key = 'super_admin' and p.key = 'partners.manage'
on conflict (role_id, permission_id) do nothing;

-- =====================================================================
--  RLS — KUCHLI IZOLYATSIYA (har hamkor faqat o'zinikini ko'radi)
-- =====================================================================

-- partners
alter table partners enable row level security;
create policy "platform manage partners" on partners
  for all using (has_permission('partners.manage')) with check (has_permission('partners.manage'));
create policy "member read own partner" on partners
  for select using (id = current_partner_id());
create policy "partner_admin update own partner" on partners
  for update using (id = current_partner_id() and is_partner_admin())
  with check (id = current_partner_id() and is_partner_admin());

-- partner_members
alter table partner_members enable row level security;
create policy "platform manage members" on partner_members
  for all using (has_permission('partners.manage')) with check (has_permission('partners.manage'));
create policy "read own partner members" on partner_members
  for select using (partner_id = current_partner_id());
create policy "partner_admin manage own members" on partner_members
  for all using (partner_id = current_partner_id() and is_partner_admin())
  with check (partner_id = current_partner_id() and is_partner_admin());

-- partner_api_credentials — sirlar klientга O'QILMAYDI (faqat platforma admin + service role)
alter table partner_api_credentials enable row level security;
create policy "platform manage api creds" on partner_api_credentials
  for all using (has_permission('partners.manage')) with check (has_permission('partners.manage'));
create policy "partner_admin insert own api creds" on partner_api_credentials
  for insert with check (partner_id = current_partner_id() and is_partner_admin());
create policy "partner_admin update own api creds" on partner_api_credentials
  for update using (partner_id = current_partner_id() and is_partner_admin())
  with check (partner_id = current_partner_id() and is_partner_admin());

-- partner_chat_messages
alter table partner_chat_messages enable row level security;
create policy "platform read all partner chat" on partner_chat_messages
  for select using (has_permission('partners.manage'));
create policy "members read own partner chat" on partner_chat_messages
  for select using (partner_id = current_partner_id());
create policy "members write own partner chat" on partner_chat_messages
  for insert with check (partner_id = current_partner_id() and sender_id = auth.uid());

-- global_chat_messages
alter table global_chat_messages enable row level security;
create policy "partners+platform read global chat" on global_chat_messages
  for select using (current_partner_id() is not null or has_permission('partners.manage'));
create policy "write global chat" on global_chat_messages
  for insert with check (sender_id = auth.uid());

-- =====================================================================
--  TAYYOR. Endi menga "men qo'ydim" deng — kodni (panel + chatlar) yozaman.
-- =====================================================================
