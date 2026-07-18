-- =========================================================
-- 0001 — EXTENSIONS & GENERIC HELPERS
-- =========================================================
create extension if not exists pgcrypto;   -- gen_random_uuid()
create extension if not exists pg_trgm;    -- fast ILIKE / fuzzy search on text (search feature, Phase 5)

-- Generic trigger: keeps updated_at current on every UPDATE.
-- Applied to every table below that has an updated_at column.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
