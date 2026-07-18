-- =========================================================
-- 0006 — MEDIA LIBRARY
-- Metadata for files stored in the "media" and "apk" Supabase Storage
-- buckets (created in migration 0019). Referenced by posts, football
-- news, advertisements, etc. via foreign keys instead of raw URLs.
-- =========================================================
create table media (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  storage_path text not null,        -- path inside the Supabase Storage bucket
  public_url text not null,
  mime_type text not null,
  file_size_bytes bigint,
  width int,
  height int,
  alt_text text,
  uploaded_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index idx_media_uploaded_by on media(uploaded_by);
create index idx_media_not_deleted on media(created_at desc) where deleted_at is null;

alter table media enable row level security;

-- Public read: image URLs must load on the public website without login.
create policy "public read media" on media
  for select using (deleted_at is null);

create policy "media.manage full access" on media
  for all using (has_permission('media.manage')) with check (has_permission('media.manage'));

create trigger trg_audit_media
  after insert or update or delete on media
  for each row execute function public.audit_trigger();
