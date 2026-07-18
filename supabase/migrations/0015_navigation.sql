-- =========================================================
-- 0015 — NAVIGATION (header/footer menu items, admin-orderable tree)
-- =========================================================
create table navigation_items (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  url text not null,
  location text not null check (location in ('header', 'footer')),
  parent_id uuid references navigation_items(id) on delete cascade,
  position int not null default 0,
  is_active boolean not null default true,
  opens_new_tab boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index idx_navigation_location_position on navigation_items(location, position) where deleted_at is null;

create trigger trg_navigation_items_updated_at before update on navigation_items
  for each row execute function public.set_updated_at();
create trigger trg_audit_navigation_items
  after insert or update or delete on navigation_items
  for each row execute function public.audit_trigger();

alter table navigation_items enable row level security;
create policy "public read active navigation" on navigation_items
  for select using (is_active = true and deleted_at is null);
create policy "navigation.manage full access" on navigation_items
  for all using (has_permission('navigation.manage')) with check (has_permission('navigation.manage'));
