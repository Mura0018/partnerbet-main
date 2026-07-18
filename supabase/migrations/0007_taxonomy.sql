-- =========================================================
-- 0007 — TAXONOMY: categories (per content type, nestable) & tags (global)
-- =========================================================
create table categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  content_type text not null check (content_type in ('post', 'football_news')),
  parent_id uuid references categories(id) on delete set null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (slug, content_type)
);
create index idx_categories_content_type on categories(content_type) where deleted_at is null;
create index idx_categories_parent on categories(parent_id);

create trigger trg_categories_updated_at before update on categories
  for each row execute function public.set_updated_at();
create trigger trg_audit_categories
  after insert or update or delete on categories
  for each row execute function public.audit_trigger();

alter table categories enable row level security;
create policy "public read categories" on categories
  for select using (deleted_at is null);
create policy "taxonomy.manage full access categories" on categories
  for all using (has_permission('taxonomy.manage')) with check (has_permission('taxonomy.manage'));

create table tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  created_at timestamptz not null default now()
);

alter table tags enable row level security;
create policy "public read tags" on tags for select using (true);
create policy "taxonomy.manage full access tags" on tags
  for all using (has_permission('taxonomy.manage')) with check (has_permission('taxonomy.manage'));
