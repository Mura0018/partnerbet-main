-- =========================================================
-- 0029 — FINAL RELEASE: audit fixes
-- Found during the Final Release full-project audit. Applied as a new
-- migration rather than editing migration history, per established
-- practice (see 0020's own header for the same rationale).
-- =========================================================

-- ---------------------------------------------------------------
-- FIX 1 — redundant index. `cache_key` already has a UNIQUE constraint
-- (0026), which Postgres backs with its own implicit unique btree index.
-- The separate `idx_football_cache_key` index duplicated it exactly —
-- same column, same order — adding write overhead for zero query benefit.
-- ---------------------------------------------------------------
drop index if exists idx_football_cache_key;

-- Note: login_attempts(ip_address, created_at) was checked during this
-- audit and already has the correct composite index from migration 0022
-- — no fix needed there.
