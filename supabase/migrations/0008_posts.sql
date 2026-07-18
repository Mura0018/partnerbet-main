-- =========================================================
-- 0008 — POSTS (blog / SEO articles). Replaces "blog_posts".
-- =========================================================
create table posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  excerpt text,
  content text not null,
  cover_media_id uuid references media(id) on delete set null,
  category_id uuid references categories(id) on delete set null,
  author_id uuid references profiles(id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'published', 'archived')),
  language text not null default 'en' check (language in ('en', 'ru', 'uz')),
  seo_title text,
  seo_description text,
  seo_keywords text[],
  view_count bigint not null default 0,
  published_at timestamptz,
  scheduled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
-- Pagination / listing queries always filter by status + order by published_at.
create index idx_posts_status_published on posts(status, published_at desc) where deleted_at is null;
create index idx_posts_category on posts(category_id);
create index idx_posts_author on posts(author_id);
create index idx_posts_slug on posts(slug) where deleted_at is null;
create index idx_posts_title_trgm on posts using gin (title gin_trgm_ops); -- fast search (Phase 5)

create trigger trg_posts_updated_at before update on posts
  for each row execute function public.set_updated_at();
create trigger trg_audit_posts
  after insert or update or delete on posts
  for each row execute function public.audit_trigger();

alter table posts enable row level security;
create policy "public read published posts" on posts
  for select using (status = 'published' and deleted_at is null and (published_at is null or published_at <= now()));
create policy "posts.manage full access" on posts
  for all using (has_permission('posts.manage')) with check (has_permission('posts.manage'));

create table post_tags (
  post_id uuid not null references posts(id) on delete cascade,
  tag_id uuid not null references tags(id) on delete cascade,
  primary key (post_id, tag_id)
);
create index idx_post_tags_tag on post_tags(tag_id);

alter table post_tags enable row level security;
create policy "public read post_tags" on post_tags for select using (true);
create policy "posts.manage full access post_tags" on post_tags
  for all using (has_permission('posts.manage')) with check (has_permission('posts.manage'));
