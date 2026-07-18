-- =========================================================
-- 0013 — ADVERTISEMENTS (unifies old "ads" + planned "banners" into one
-- table via a `kind` discriminator — avoids two near-identical tables).
-- =========================================================
create table advertisements (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('image', 'embed', 'banner')),
  placement text not null check (placement in (
    'homepage', 'blog', 'insights', 'football_news', 'apk_page',
    'popup', 'sticky', 'sidebar', 'footer', 'header'
  )),
  title text,
  image_media_id uuid references media(id) on delete set null,
  image_url text,        -- fallback for direct URL entry before Media Library (Phase 4) is wired up
  embed_code text,
  target_url text,
  position int not null default 0,
  is_active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  clicks bigint not null default 0,
  views bigint not null default 0,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index idx_advertisements_placement_active
  on advertisements(placement, is_active) where deleted_at is null;

create trigger trg_advertisements_updated_at before update on advertisements
  for each row execute function public.set_updated_at();
create trigger trg_audit_advertisements
  after insert or update or delete on advertisements
  for each row execute function public.audit_trigger();

alter table advertisements enable row level security;
create policy "public read active advertisements" on advertisements
  for select using (is_active = true and deleted_at is null
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at >= now()));
create policy "advertisements.manage full access" on advertisements
  for all using (has_permission('advertisements.manage')) with check (has_permission('advertisements.manage'));
