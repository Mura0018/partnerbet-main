-- =====================================================================
--  B7 (E) — REKLAMA BANNER
--  Mijoz app pastида almashib turadigan reklama bannerlari. Super admin
--  (promo.manage) qo'shadi/tahrirlaydi (havola, rasm, matn). App va admin
--  server API (service role) orqali o'qiydi/yozadi.
-- =====================================================================

create table if not exists promo_banners (
  id uuid primary key default gen_random_uuid(),
  title text,
  subtitle text,
  image_url text,
  link_url text,
  is_active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_promo_banners_active on promo_banners(is_active, sort);

alter table promo_banners enable row level security;
create policy "promo_banners manage" on promo_banners
  for all using (has_permission('promo.manage')) with check (has_permission('promo.manage'));
