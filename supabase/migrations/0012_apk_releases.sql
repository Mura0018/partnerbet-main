-- =========================================================
-- 0012 — APK RELEASES (same shape the app already uses + extra columns)
-- =========================================================
create table apk_releases (
  id uuid primary key default gen_random_uuid(),
  version text not null,
  download_url text not null,
  file_size_bytes bigint,
  checksum_sha256 text,
  changelog text,
  min_android text default '8.0',
  is_active boolean not null default false,
  downloads_count bigint not null default 0,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
-- DB-enforced invariant: at most one active release at a time
-- (previously only enforced by app-code doing 2 sequential updates).
create unique index idx_apk_releases_one_active
  on apk_releases (is_active)
  where is_active = true and deleted_at is null;

create index idx_apk_releases_created_at on apk_releases(created_at desc) where deleted_at is null;

create trigger trg_apk_releases_updated_at before update on apk_releases
  for each row execute function public.set_updated_at();
create trigger trg_audit_apk_releases
  after insert or update or delete on apk_releases
  for each row execute function public.audit_trigger();

alter table apk_releases enable row level security;
create policy "public read active apk" on apk_releases
  for select using (is_active = true and deleted_at is null);
create policy "apk.manage full access" on apk_releases
  for all using (has_permission('apk.manage')) with check (has_permission('apk.manage'));
