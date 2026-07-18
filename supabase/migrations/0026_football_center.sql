-- =========================================================
-- 0026 — PHASE 3c: FOOTBALL CENTER (provider-agnostic)
-- No football data provider is hardcoded anywhere in this schema or the
-- application code built on top of it — see lib/football/ for the
-- provider abstraction layer.
-- =========================================================

-- ---------------------------------------------------------------
-- New permission (this is the first genuinely NEW permission key added
-- since the initial 0002 seed — role_permissions must be backfilled
-- explicitly for existing roles rather than relying on the original
-- seed script, which only ran against permissions that existed then).
-- ---------------------------------------------------------------
insert into permissions (key, description) values
  ('football.manage', 'Manage Football Center: data provider settings, featured leagues/matches, videos');

insert into role_permissions (role_id, permission_id)
select r.id, p.id
from roles r, permissions p
where p.key = 'football.manage'
  and r.key in ('super_admin', 'admin', 'content_manager');

-- ---------------------------------------------------------------
-- Provider config lives in site_settings (non-secret: which provider is
-- active, default league/season) — the actual API keys live in
-- api_credentials (Phase 3a's secure, never-publicly-readable table).
-- ---------------------------------------------------------------
insert into site_settings (key, value) values
  ('football_provider', '{"active": null, "default_league_id": "", "default_season": ""}')
on conflict (key) do nothing;

-- ---------------------------------------------------------------
-- FOOTBALL CACHE — generic response cache for whichever provider is
-- active. Lets the Football Center survive a provider outage or rate
-- limit by serving the last-known-good response instead of crashing,
-- and reduces API usage. Server-only (no public RLS policy) — read and
-- written exclusively by lib/football/cache.ts via the service-role client.
-- ---------------------------------------------------------------
create table football_cache (
  id uuid primary key default gen_random_uuid(),
  cache_key text not null unique,   -- e.g. "fixtures:live", "standings:39:2026"
  provider text not null,
  data jsonb not null,
  cached_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index idx_football_cache_key on football_cache(cache_key);
create index idx_football_cache_expires on football_cache(expires_at);

alter table football_cache enable row level security;
-- Intentionally no policies — server-only via service-role client.

-- ---------------------------------------------------------------
-- FEATURED LEAGUES — lets the admin curate which leagues appear in the
-- Football Center (League Tables selector, homepage) without any league
-- ID ever being hardcoded in application code.
-- ---------------------------------------------------------------
create table featured_leagues (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  external_league_id text not null,
  name text not null,
  logo_url text,
  country text,
  season text,
  position int not null default 0,
  is_active boolean not null default true,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, external_league_id)
);
create index idx_featured_leagues_active on featured_leagues(position) where is_active = true;

create trigger trg_featured_leagues_updated_at before update on featured_leagues
  for each row execute function public.set_updated_at();
create trigger trg_audit_featured_leagues
  after insert or update or delete on featured_leagues
  for each row execute function public.audit_trigger();

alter table featured_leagues enable row level security;
create policy "public read active featured_leagues" on featured_leagues
  for select using (is_active = true);
create policy "football.manage full access featured_leagues" on featured_leagues
  for all using (has_permission('football.manage')) with check (has_permission('football.manage'));

-- ---------------------------------------------------------------
-- FEATURED FIXTURES — admin "pins" a specific match (from whichever
-- provider is active) to be highlighted; the live fixture data itself is
-- still fetched/cached from the provider at render time, only the pin +
-- an optional editorial note are stored locally.
-- ---------------------------------------------------------------
create table featured_fixtures (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  external_fixture_id text not null,
  note text,
  position int not null default 0,
  is_active boolean not null default true,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, external_fixture_id)
);
create index idx_featured_fixtures_active on featured_fixtures(position) where is_active = true;

create trigger trg_featured_fixtures_updated_at before update on featured_fixtures
  for each row execute function public.set_updated_at();
create trigger trg_audit_featured_fixtures
  after insert or update or delete on featured_fixtures
  for each row execute function public.audit_trigger();

alter table featured_fixtures enable row level security;
create policy "public read active featured_fixtures" on featured_fixtures
  for select using (is_active = true);
create policy "football.manage full access featured_fixtures" on featured_fixtures
  for all using (has_permission('football.manage')) with check (has_permission('football.manage'));

-- ---------------------------------------------------------------
-- FOOTBALL VIDEOS — editorial content, not from any provider API.
-- ---------------------------------------------------------------
create table football_videos (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 200),
  video_url text not null check (video_url ~ '^https?://'),
  thumbnail_media_id uuid references media(id) on delete set null,
  description text,
  is_featured boolean not null default false,
  is_active boolean not null default true,
  published_at timestamptz not null default now(),
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index idx_football_videos_active on football_videos(published_at desc) where is_active = true and deleted_at is null;

create trigger trg_football_videos_updated_at before update on football_videos
  for each row execute function public.set_updated_at();
create trigger trg_audit_football_videos
  after insert or update or delete on football_videos
  for each row execute function public.audit_trigger();

alter table football_videos enable row level security;
create policy "public read active football_videos" on football_videos
  for select using (is_active = true and deleted_at is null);
create policy "football.manage full access football_videos" on football_videos
  for all using (has_permission('football.manage')) with check (has_permission('football.manage'));
