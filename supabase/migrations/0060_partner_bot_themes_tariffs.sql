-- =====================================================================
--  HAMKOR — BOT (o'z mini-app'i) + TEMALAR (1 bepul + 2 premium) + TARIFLAR
--  Supabase SQL Editor'da bir marta ishga tushiring. Additive (xavfsiz).
-- =====================================================================

-- ---------- partners: bot holati + tema/plan (MAXFIY token bu yerda EMAS) ----------
alter table partners add column if not exists bot_username text;
alter table partners add column if not exists bot_connected boolean not null default false;
alter table partners add column if not exists theme_key text not null default 'classic';
alter table partners add column if not exists plan text not null default 'free' check (plan in ('free','premium'));

-- ---------- App temalari (3 ta): 1 bepul + 2 premium ----------
create table if not exists app_themes (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  is_premium boolean not null default false,
  accent text,                 -- asosiy rang (preview)
  is_active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
insert into app_themes (key, name, is_premium, accent, sort) values
  ('classic', 'Classic (bepul)', false, '#3D7FFF', 1),
  ('neon',    'Neon Premium',    true,  '#22d3ee', 2),
  ('royal',   'Royal Premium',   true,  '#F4C76A', 3)
on conflict (key) do nothing;

-- ---------- Hamkorga ochilgan premium temalar (super admin yoqadi) ----------
create table if not exists partner_theme_access (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references partners(id) on delete cascade,
  theme_id uuid not null references app_themes(id) on delete cascade,
  enabled boolean not null default true,
  granted_by uuid references profiles(id),
  granted_at timestamptz not null default now(),
  unique (partner_id, theme_id)
);
create index if not exists idx_pta_partner on partner_theme_access(partner_id);

-- ---------- Tariflar (umumiy narxlar — super admin belgilaydi) ----------
create table if not exists tariffs (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  price numeric(14,2) not null default 0,
  currency text not null default 'UZS',
  period text not null default 'monthly' check (period in ('monthly','one_time')),
  is_active boolean not null default true,
  updated_by uuid references profiles(id),
  updated_at timestamptz not null default now()
);
insert into tariffs (key, name, price, period) values
  ('subscription_monthly', 'Oylik obuna',      0, 'monthly'),
  ('premium_theme',        'Premium tema',     0, 'one_time'),
  ('premium_bundle',       'Premium to''plam', 0, 'monthly')
on conflict (key) do nothing;

-- Maxfiy bot tokeni: partner_api_credentials (provider='telegram_bot') da saqlanadi
-- (0058 dagi jadval klientga o'qilmaydi). Shuning uchun alohida jadval shart emas.

-- ---------- XAVFSIZLIK: hamkor imtiyozli ustunlarni o'zgartira olmaydi ----------
create or replace function public.protect_partner_privileged_cols()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not has_permission('partners.manage') then
    new.plan := old.plan;
    new.commission_pct := old.commission_pct;
    new.subscription_amount := old.subscription_amount;
    new.status := old.status;
    new.billing_model := old.billing_model;
    new.bot_connected := old.bot_connected;   -- faqat server (service role) o'zgartiradi
  end if;
  return new;
end $$;
drop trigger if exists trg_protect_partner_cols on partners;
create trigger trg_protect_partner_cols before update on partners
  for each row execute function public.protect_partner_privileged_cols();

-- ---------- RLS ----------
alter table app_themes enable row level security;
create policy "read themes" on app_themes for select using (auth.role() = 'authenticated');
create policy "platform manage themes" on app_themes
  for all using (has_permission('partners.manage')) with check (has_permission('partners.manage'));

alter table partner_theme_access enable row level security;
create policy "platform manage theme access" on partner_theme_access
  for all using (has_permission('partners.manage')) with check (has_permission('partners.manage'));
create policy "members read own theme access" on partner_theme_access
  for select using (partner_id = current_partner_id());

alter table tariffs enable row level security;
create policy "read tariffs" on tariffs for select using (auth.role() = 'authenticated');
create policy "platform manage tariffs" on tariffs
  for all using (has_permission('partners.manage')) with check (has_permission('partners.manage'));
