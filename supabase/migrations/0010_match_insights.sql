-- =========================================================
-- 0010 — MATCH INSIGHTS. Replaces "insights" (same columns app already
-- uses, now with soft delete, updated_by, and profiles FK instead of
-- admin_profiles).
-- =========================================================
create table match_insights (
  id uuid primary key default gen_random_uuid(),
  league text not null,
  home_team text not null,
  away_team text not null,
  match_time timestamptz not null,
  expected_goals text,
  possession_trend text,
  confidence smallint check (confidence between 0 and 100),
  analysis text,
  status text not null default 'UPCOMING'
    check (status in ('UPCOMING', 'LIVE', 'WIN', 'LOST', 'PUSH', 'POSTPONED', 'CANCELLED')),
  created_by uuid references profiles(id) on delete set null,
  updated_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index idx_match_insights_match_time on match_insights(match_time) where deleted_at is null;
create index idx_match_insights_status on match_insights(status);
create index idx_match_insights_league on match_insights(league);

create trigger trg_match_insights_updated_at before update on match_insights
  for each row execute function public.set_updated_at();
create trigger trg_audit_match_insights
  after insert or update or delete on match_insights
  for each row execute function public.audit_trigger();

alter table match_insights enable row level security;
create policy "public read match_insights" on match_insights
  for select using (deleted_at is null);
create policy "match_insights.manage full access" on match_insights
  for all using (has_permission('match_insights.manage')) with check (has_permission('match_insights.manage'));
