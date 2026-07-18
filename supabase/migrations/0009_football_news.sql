-- =========================================================
-- 0009 — FOOTBALL NEWS (distinct from generic posts: league-tagged)
-- =========================================================
create table football_news (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  excerpt text,
  content text not null,
  cover_media_id uuid references media(id) on delete set null,
  category_id uuid references categories(id) on delete set null,
  league text,
  author_id uuid references profiles(id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'published', 'archived')),
  seo_title text,
  seo_description text,
  view_count bigint not null default 0,
  published_at timestamptz,
  scheduled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index idx_football_news_status_published on football_news(status, published_at desc) where deleted_at is null;
create index idx_football_news_league on football_news(league);
create index idx_football_news_category on football_news(category_id);

create trigger trg_football_news_updated_at before update on football_news
  for each row execute function public.set_updated_at();
create trigger trg_audit_football_news
  after insert or update or delete on football_news
  for each row execute function public.audit_trigger();

alter table football_news enable row level security;
create policy "public read published football_news" on football_news
  for select using (status = 'published' and deleted_at is null and (published_at is null or published_at <= now()));
create policy "football_news.manage full access" on football_news
  for all using (has_permission('football_news.manage')) with check (has_permission('football_news.manage'));
