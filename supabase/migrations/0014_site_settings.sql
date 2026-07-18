-- =========================================================
-- 0014 — SITE SETTINGS (generic key/value JSONB store)
-- Powers the "website builder" admin sections (Homepage, Header, Footer,
-- Hero, Theme, SEO defaults, Analytics, Contact, Social links) WITHOUT a
-- separate table per section — each is one JSONB row, editable from the
-- dashboard, extensible without new migrations for new fields inside it.
-- =========================================================
create table site_settings (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  value jsonb not null default '{}'::jsonb,
  updated_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_site_settings_updated_at before update on site_settings
  for each row execute function public.set_updated_at();
create trigger trg_audit_site_settings
  after insert or update or delete on site_settings
  for each row execute function public.audit_trigger();

alter table site_settings enable row level security;
-- Public read: the frontend needs these values (site name, hero copy,
-- contact email, social links, SEO defaults, theme) to render pages.
create policy "public read site_settings" on site_settings
  for select using (true);
create policy "settings.manage full access" on site_settings
  for all using (has_permission('settings.manage')) with check (has_permission('settings.manage'));

-- ---------- Seed: structural rows only (empty/neutral defaults, no fake content) ----------
insert into site_settings (key, value) values
  ('site_identity', '{"site_name": "PartnerBet", "tagline": "", "logo_media_id": null}'),
  ('hero_section', '{"headline": "", "subheadline": "", "cta_label": "", "cta_url": ""}'),
  ('contact_info', '{"email": "", "phone": "", "address": ""}'),
  ('social_links', '{"facebook": "", "instagram": "", "telegram": "", "twitter": ""}'),
  ('seo_defaults', '{"default_title": "", "default_description": "", "og_image_media_id": null}'),
  ('analytics', '{"ga_measurement_id": "", "meta_pixel_id": ""}'),
  ('theme', '{"mode": "dark", "accent_color": "#00A3FF"}');
