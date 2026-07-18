-- =========================================================
-- 0023 — PROFILE LOCALE (per-user UI language preference)
-- =========================================================
alter table profiles
  add column locale text not null default 'uz' check (locale in ('uz', 'ru', 'en'));
