-- =========================================================
-- 0022 — LOGIN ATTEMPTS (brute-force protection / rate limiting)
-- Written exclusively by the server (service-role client) from the
-- /api/auth/login route — no RLS policy grants anon/authenticated
-- access at all, so this table is invisible to every normal client.
-- =========================================================
create table login_attempts (
  id uuid primary key default gen_random_uuid(),
  identifier text not null,     -- lowercased email being attempted
  ip_address text,
  user_agent text,
  success boolean not null,
  created_at timestamptz not null default now()
);
create index idx_login_attempts_identifier on login_attempts(identifier, created_at desc);
create index idx_login_attempts_ip on login_attempts(ip_address, created_at desc);
create index idx_login_attempts_created_at_brin on login_attempts using brin (created_at);

alter table login_attempts enable row level security;
-- Intentionally NO policies at all: only the service-role key (which
-- bypasses RLS entirely) may read/write this table.
