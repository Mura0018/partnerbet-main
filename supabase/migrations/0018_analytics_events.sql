-- =========================================================
-- 0018 — ANALYTICS EVENTS (high-volume, append-only, time-series)
-- BRIN index instead of btree on created_at: this table is expected to
-- reach millions of rows, and BRIN stays tiny + fast for time-ordered inserts.
-- =========================================================
create table analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,     -- page_view, apk_download, promo_copy, register_click, ad_click
  country text,
  language text,
  device text,
  meta jsonb,
  created_at timestamptz not null default now()
);
create index idx_analytics_events_type on analytics_events(event_type);
create index idx_analytics_events_created_at_brin on analytics_events using brin (created_at);

alter table analytics_events enable row level security;
create policy "public insert analytics" on analytics_events
  for insert with check (true);
create policy "logs.view read analytics" on analytics_events
  for select using (has_permission('logs.view'));
