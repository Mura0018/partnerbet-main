-- =========================================================
-- 0027 — PHASE 3d: NEWS CMS
-- Categories/tags/post_tags already exist from Phase 1 — this migration
-- only adds what was missing: a denormalized cover image URL (same
-- pattern already used for affiliate_partners.logo_url and
-- site_settings.branding, avoids a join on every public page render).
-- =========================================================
alter table posts add column cover_url text;
alter table football_news add column cover_url text;
