-- =========================================================
-- 0032 — VERSION 1.3.0: PRODUCTION INTEGRATION & VERIFICATION
-- Found during full-system rate-limiting review: several genuinely
-- public write endpoints (view-count tracking, promo-code usage
-- tracking, push subscribe/unsubscribe) had no abuse protection at all.
-- Low severity (cosmetic metrics / opt-in noise, not financial or data
-- risk), but still real gaps — see PRODUCTION_READINESS_REPORT.md.
-- =========================================================

-- Generic, reusable rate-limit ledger — server-only (no RLS policies),
-- written exclusively via lib/security/rateLimit.ts. A single shared
-- table instead of a bespoke one per feature (login/streaming/donations
-- already had their own domain-table-based counters before this
-- version and are intentionally left as-is to avoid touching
-- already-verified code — see PRODUCTION_READINESS_REPORT.md).
create table rate_limit_events (
  id uuid primary key default gen_random_uuid(),
  bucket text not null,
  created_at timestamptz not null default now()
);
create index idx_rate_limit_events_bucket on rate_limit_events(bucket, created_at desc);
-- Old entries are cheap to accumulate (small rows, short lookback
-- windows) but a scheduled cleanup is straightforward to add later via
-- the existing Vercel Cron (vercel.json) if the table grows large.

alter table rate_limit_events enable row level security;
-- Intentionally no policies — server-only via service-role client.
