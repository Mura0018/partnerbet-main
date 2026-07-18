-- =========================================================
-- 0011 — PROMOTIONS (replaces hardcoded PROMOS array in the frontend)
-- =========================================================
create table promotions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  description text,
  terms text,
  partner_name text,
  cta_url text,
  is_active boolean not null default true,
  valid_from timestamptz,
  valid_until timestamptz,
  click_count bigint not null default 0,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index idx_promotions_active on promotions(is_active) where deleted_at is null;

create trigger trg_promotions_updated_at before update on promotions
  for each row execute function public.set_updated_at();
create trigger trg_audit_promotions
  after insert or update or delete on promotions
  for each row execute function public.audit_trigger();

alter table promotions enable row level security;
create policy "public read active promotions" on promotions
  for select using (is_active = true and deleted_at is null
    and (valid_from is null or valid_from <= now())
    and (valid_until is null or valid_until >= now()));
create policy "promotions.manage full access" on promotions
  for all using (has_permission('promotions.manage')) with check (has_permission('promotions.manage'));
