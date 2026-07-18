-- =========================================================
-- 0028 — PHASE 4: MEDIA LIBRARY (gallery UI backing) + PUSH NOTIFICATIONS
-- =========================================================

-- media table already exists (Phase 1) with everything the gallery UI
-- needs (file_name, public_url, mime_type, file_size_bytes, uploaded_by,
-- created_at, deleted_at) — no schema change needed there, only a proper
-- browsing/search UI (this phase's app-layer work).

-- ---------------------------------------------------------------
-- PUSH SUBSCRIPTIONS (Web Push)
-- Visitors opt in from the browser; no login required, so there is no
-- "owner" to scope RLS to. The endpoint URL itself is a long, unguessable,
-- unique value issued by the browser's push service — it functions like a
-- bearer token, which is why public insert/delete-by-endpoint is safe.
-- ---------------------------------------------------------------
create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  country text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
create index idx_push_subscriptions_created_at on push_subscriptions(created_at desc);

alter table push_subscriptions enable row level security;

-- Any visitor can subscribe (opt-in) or unsubscribe (by their own,
-- unguessable endpoint) — this is the standard Web Push trust model.
create policy "public insert subscription" on push_subscriptions
  for insert with check (true);
create policy "public delete own subscription" on push_subscriptions
  for delete using (true);

-- Only admins with settings.manage may LIST subscriptions (e.g. to show
-- a subscriber count in the admin UI) — the raw endpoint/keys are still
-- sensitive (they allow sending push messages to that specific browser).
create policy "settings.manage read subscriptions" on push_subscriptions
  for select using (has_permission('settings.manage'));

-- ---------------------------------------------------------------
-- PUSH NOTIFICATION LOG (audit trail of what was broadcast, and to how
-- many recipients / how many failed) — distinct from the generic
-- audit_logs table because this tracks a bulk external side-effect, not
-- a single row change.
-- ---------------------------------------------------------------
create table push_notification_log (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  url text,
  sent_by uuid references profiles(id) on delete set null,
  recipients_count int not null default 0,
  failures_count int not null default 0,
  created_at timestamptz not null default now()
);

alter table push_notification_log enable row level security;
create policy "settings.manage full access push_log" on push_notification_log
  for all using (has_permission('settings.manage')) with check (has_permission('settings.manage'));
