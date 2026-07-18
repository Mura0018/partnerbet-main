-- =========================================================
-- 0024 — PHASE 3a: SITE SETTINGS EXPANSION + SECURE API CREDENTIALS
-- =========================================================

-- ---------- New site_settings keys (public, non-secret config) ----------
insert into site_settings (key, value) values
  ('footer', '{"description": "", "footer_text": ""}'),
  ('maintenance', '{"enabled": false, "message": ""}'),
  ('branding', '{"logo_media_id": null, "favicon_media_id": null}')
on conflict (key) do nothing;

-- Expand the existing "theme" row with the extra colour fields Phase 3
-- needs (site already has "theme" from 0014 with mode+accent_color).
update site_settings
set value = value || '{"secondary_color": "#FFC857", "background_color": "#07111F"}'::jsonb
where key = 'theme'
  and not (value ? 'secondary_color');

-- =========================================================
-- SECURE API CREDENTIALS
-- Stores secrets that must NEVER be exposed to the browser (football API
-- key, push notification server keys). Unlike site_settings, this table
-- has NO RLS policies at all for anon/authenticated — only the
-- service-role key (used exclusively from server-only API routes) can
-- read or write it. The admin UI never receives the actual secret value
-- back, only a "configured / not configured" status.
-- =========================================================
create table api_credentials (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,   -- e.g. 'football_api_key', 'push_fcm_server_key'
  value text not null,
  is_active boolean not null default true,
  updated_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_api_credentials_updated_at before update on api_credentials
  for each row execute function public.set_updated_at();
create trigger trg_audit_api_credentials
  after insert or update or delete on api_credentials
  for each row execute function public.audit_trigger();

alter table api_credentials enable row level security;
-- Intentionally NO policies: only the service-role client can touch this
-- table, from server-only route handlers, after that route independently
-- verifies the caller holds settings.manage via has_permission().
