-- =========================================================
-- 0025 — PHASE 3b: ENTERPRISE AFFILIATE MANAGER
-- Supersedes the simple Phase 1 "promotions" table (one row = one flat
-- promo code) with a proper Partner ↔ Promo Codes ↔ Redirect Rules ↔
-- Clicks model. Architecture supports unlimited affiliate companies —
-- nothing about any specific brand is hardcoded anywhere in this schema.
-- =========================================================

-- The old flat table is fully replaced by affiliate_partners + promo_codes
-- below; dropping it (cascade removes its indexes/triggers/policies) keeps
-- the schema free of two overlapping "promotion" concepts.
drop table if exists promotions cascade;

-- ---------------------------------------------------------------
-- AFFILIATE PARTNERS
-- ---------------------------------------------------------------
create table affiliate_partners (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,                  -- used in /go/{slug} redirect links
  name text not null check (char_length(name) between 1 and 200),
  logo_media_id uuid references media(id) on delete set null,
  logo_url text,   -- denormalized cache of media.public_url, avoids a join on every public read
  description text check (description is null or char_length(description) <= 2000),

  website_url text check (website_url is null or website_url ~ '^https?://'),
  affiliate_url text not null check (affiliate_url ~ '^https?://'),
  apk_url text check (apk_url is null or apk_url ~ '^https?://'),
  google_play_url text check (google_play_url is null or google_play_url ~ '^https?://'),
  app_store_url text check (app_store_url is null or app_store_url ~ '^https?://'),
  deep_link text check (deep_link is null or deep_link ~ '^[a-zA-Z][a-zA-Z0-9+.-]*://'),

  bonus_description text check (bonus_description is null or char_length(bonus_description) <= 1000),
  countries text[],           -- ISO 3166-1 alpha-2 codes; null/empty = all countries
  languages text[],           -- e.g. {uz,ru,en}; null/empty = all languages
  rating numeric(2,1) check (rating is null or (rating >= 0 and rating <= 5)),
  priority int not null default 0,   -- lower = shown first
  is_active boolean not null default true,
  is_featured boolean not null default false,

  -- Link Health (populated by /api/admin/affiliates/check-links and the
  -- scheduled /api/cron/check-affiliate-links job — see AFFILIATE_MANAGER.md)
  link_health jsonb not null default '{}'::jsonb,
  link_health_checked_at timestamptz,

  click_count bigint not null default 0,   -- fast denormalized counter; affiliate_clicks is the source of truth

  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index idx_affiliate_partners_active on affiliate_partners(priority) where deleted_at is null and is_active = true;
create index idx_affiliate_partners_slug on affiliate_partners(slug) where deleted_at is null;
create index idx_affiliate_partners_featured on affiliate_partners(is_featured) where deleted_at is null and is_active = true;

create trigger trg_affiliate_partners_updated_at before update on affiliate_partners
  for each row execute function public.set_updated_at();
create trigger trg_audit_affiliate_partners
  after insert or update or delete on affiliate_partners
  for each row execute function public.audit_trigger();

alter table affiliate_partners enable row level security;
create policy "public read active partners" on affiliate_partners
  for select using (is_active = true and deleted_at is null);
create policy "promotions.manage full access partners" on affiliate_partners
  for all using (has_permission('promotions.manage')) with check (has_permission('promotions.manage'));

-- ---------------------------------------------------------------
-- PROMO CODES (a partner can have many)
-- ---------------------------------------------------------------
create table promo_codes (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references affiliate_partners(id) on delete cascade,
  code text not null check (char_length(code) between 1 and 50),
  bonus_description text check (bonus_description is null or char_length(bonus_description) <= 500),
  is_featured boolean not null default false,
  is_active boolean not null default true,
  expires_at timestamptz,
  usage_count bigint not null default 0,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (partner_id, code)
);
create index idx_promo_codes_partner on promo_codes(partner_id) where deleted_at is null;
create index idx_promo_codes_active on promo_codes(is_active) where deleted_at is null;

create trigger trg_promo_codes_updated_at before update on promo_codes
  for each row execute function public.set_updated_at();
create trigger trg_audit_promo_codes
  after insert or update or delete on promo_codes
  for each row execute function public.audit_trigger();

alter table promo_codes enable row level security;
create policy "public read active promo_codes" on promo_codes
  for select using (
    is_active = true and deleted_at is null and (expires_at is null or expires_at >= now())
  );
create policy "promotions.manage full access promo_codes" on promo_codes
  for all using (has_permission('promotions.manage')) with check (has_permission('promotions.manage'));

-- ---------------------------------------------------------------
-- SMART REDIRECT RULES (per-partner overrides by country/language/device)
-- Not publicly readable — only the server-side /go/{slug} route (via the
-- service-role client) and admins can see targeting logic.
-- ---------------------------------------------------------------
create table partner_redirect_rules (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references affiliate_partners(id) on delete cascade,
  match_type text not null check (match_type in ('country', 'language', 'device')),
  match_value text not null,   -- e.g. 'UZ', 'ru', 'mobile'
  target_url text not null check (target_url ~ '^https?://'),
  priority int not null default 0,   -- lower = evaluated first
  is_active boolean not null default true,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_redirect_rules_partner on partner_redirect_rules(partner_id, priority);

create trigger trg_redirect_rules_updated_at before update on partner_redirect_rules
  for each row execute function public.set_updated_at();
create trigger trg_audit_redirect_rules
  after insert or update or delete on partner_redirect_rules
  for each row execute function public.audit_trigger();

alter table partner_redirect_rules enable row level security;
create policy "promotions.manage full access redirect_rules" on partner_redirect_rules
  for all using (has_permission('promotions.manage')) with check (has_permission('promotions.manage'));
-- Intentionally no public policy — the /go route reads this via the
-- service-role client (server-only, not exposed to the browser).

-- ---------------------------------------------------------------
-- CLICK ANALYTICS (high-volume, append-only, time-series)
-- Written exclusively by /go/{slug} via the service-role client.
-- ---------------------------------------------------------------
create table affiliate_clicks (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid references affiliate_partners(id) on delete set null,
  banner_id uuid references advertisements(id) on delete set null,
  target_url text not null,
  country text,
  device text check (device in ('desktop', 'mobile', 'tablet', 'unknown')),
  browser text,
  language text,
  referrer text,
  created_at timestamptz not null default now()
);
create index idx_affiliate_clicks_partner on affiliate_clicks(partner_id, created_at desc);
create index idx_affiliate_clicks_created_at_brin on affiliate_clicks using brin (created_at);
create index idx_affiliate_clicks_country on affiliate_clicks(country);
create index idx_affiliate_clicks_device on affiliate_clicks(device);

alter table affiliate_clicks enable row level security;
create policy "promotions.manage read affiliate_clicks" on affiliate_clicks
  for select using (has_permission('promotions.manage'));
-- No insert/update/delete policy for anyone — only the service-role
-- client (from /go/{slug}) writes here.

-- ---------------------------------------------------------------
-- BANNER MANAGER: extend the existing advertisements table (Phase 1)
-- rather than creating a second, overlapping "banners" table.
-- ---------------------------------------------------------------
alter table advertisements
  add column partner_id uuid references affiliate_partners(id) on delete set null,
  add column banner_size text check (banner_size in ('desktop', 'tablet', 'mobile', 'square', 'popup', 'sticky', 'hero')),
  add column target_countries text[],   -- null/empty = all countries
  add column target_languages text[],   -- null/empty = all languages
  add column width_px int,
  add column height_px int;

-- Retroactive URL validation (Phase 1 shipped these columns without a
-- format check) — added now as part of the Phase 3b security requirement
-- to validate every URL at the database level.
alter table advertisements
  add constraint chk_advertisements_target_url check (target_url is null or target_url ~ '^https?://'),
  add constraint chk_advertisements_image_url check (image_url is null or image_url ~ '^https?://');

create index idx_advertisements_partner on advertisements(partner_id);
create index idx_advertisements_banner_size on advertisements(banner_size) where deleted_at is null;
