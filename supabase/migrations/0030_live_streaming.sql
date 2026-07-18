-- =========================================================
-- 0030 — VERSION 1.1.0: LIVE STREAMING SYSTEM
-- No streaming provider is hardcoded. Providers are entirely
-- admin-defined data (name, base API URL, credentials) consumed by ONE
-- generic, configurable adapter (lib/streaming/) — see
-- LIVE_STREAMING_ARCHITECTURE.md for why this differs from the Football
-- Data provider design (Phase 3c had 3 REAL, documented APIs to adapt to;
-- no such public "official sports streaming API" exists to model against,
-- so the architecture stays provider-shape-agnostic by design).
-- =========================================================

-- ---------------------------------------------------------------
-- New permission (backfilled to existing roles — see 0026 for why this
-- backfill pattern is necessary rather than relying on the original seed).
-- ---------------------------------------------------------------
insert into permissions (key, description) values
  ('streaming.manage', 'Manage live streaming providers and match stream assignments');

insert into role_permissions (role_id, permission_id)
select r.id, p.id
from roles r, permissions p
where p.key = 'streaming.manage'
  and r.key in ('super_admin', 'admin', 'content_manager');

-- ---------------------------------------------------------------
-- STREAMING PROVIDERS
-- Credentials (api_credentials.key = 'streaming:{provider.id}:api_key' /
-- '...:api_secret') are stored ENCRYPTED (lib/security/encryption.ts,
-- AES-256-GCM) — this table itself never holds the key/secret value,
-- only connection status/metadata.
-- ---------------------------------------------------------------
create table streaming_providers (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,     -- slug, e.g. 'provider-a' — used to build the credential keys
  name text not null check (char_length(name) between 1 and 100),
  base_api_url text not null check (base_api_url ~ '^https?://'),
  priority int not null default 0,
  is_active boolean not null default true,
  connection_status text not null default 'unknown' check (connection_status in ('unknown', 'connected', 'error')),
  last_sync_at timestamptz,
  last_error text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index idx_streaming_providers_active on streaming_providers(priority) where is_active = true and deleted_at is null;

create trigger trg_streaming_providers_updated_at before update on streaming_providers
  for each row execute function public.set_updated_at();
create trigger trg_audit_streaming_providers
  after insert or update or delete on streaming_providers
  for each row execute function public.audit_trigger();

alter table streaming_providers enable row level security;
create policy "streaming.manage full access providers" on streaming_providers
  for all using (has_permission('streaming.manage')) with check (has_permission('streaming.manage'));
-- Intentionally NO public policy — base_api_url and connection metadata
-- are not needed by the public site directly. The public site learns
-- only "is a stream available + provider display name" via the
-- /api/streaming/* routes (service-role, selecting only safe columns).

-- ---------------------------------------------------------------
-- MATCH STREAMS
-- Assigns one or more streaming providers to a specific match. The match
-- itself is identified by (football_provider, external_fixture_id) —
-- i.e. whichever Football Data provider (Phase 3c) the fixture ID
-- belongs to — exactly like featured_fixtures (Phase 3c) already does,
-- for the same reason: fixture IDs are only unique within their own
-- provider's ID space.
-- ---------------------------------------------------------------
create table match_streams (
  id uuid primary key default gen_random_uuid(),
  football_provider text not null,
  external_fixture_id text not null,
  streaming_provider_id uuid not null references streaming_providers(id) on delete cascade,
  external_stream_id text,   -- the streaming provider's own identifier for this stream, if different from the fixture id
  is_primary boolean not null default false,
  is_active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (football_provider, external_fixture_id, streaming_provider_id)
);
create index idx_match_streams_fixture on match_streams(football_provider, external_fixture_id) where is_active = true;
create index idx_match_streams_provider on match_streams(streaming_provider_id);

create trigger trg_match_streams_updated_at before update on match_streams
  for each row execute function public.set_updated_at();
create trigger trg_audit_match_streams
  after insert or update or delete on match_streams
  for each row execute function public.audit_trigger();

alter table match_streams enable row level security;
create policy "streaming.manage full access match_streams" on match_streams
  for all using (has_permission('streaming.manage')) with check (has_permission('streaming.manage'));
-- No public policy — the public site reaches this only through
-- /api/streaming/* (service-role), which returns availability + provider
-- name only, never raw rows.

-- ---------------------------------------------------------------
-- STREAMING CONNECTION LOGS (Test Connection results + sync history —
-- the "Error Logs" admin panel requirement).
-- ---------------------------------------------------------------
create table streaming_connection_logs (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid references streaming_providers(id) on delete cascade,
  event_type text not null check (event_type in ('test_connection', 'sync')),
  success boolean not null,
  message text,
  created_at timestamptz not null default now()
);
create index idx_streaming_connection_logs_provider on streaming_connection_logs(provider_id, created_at desc);

alter table streaming_connection_logs enable row level security;
create policy "streaming.manage read connection_logs" on streaming_connection_logs
  for select using (has_permission('streaming.manage'));
-- No insert/update/delete policy for anyone — only the server-side test
-- connection / sync routes (service-role) write here.
