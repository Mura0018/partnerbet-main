-- =========================================================
-- 0050 — SECURITY LOG (super admin)
-- Builds on the login_attempts table that already exists (0022) for
-- brute-force rate limiting — this adds the ability to actually act on
-- what it records: block an IP outright, and gates a new admin page
-- (plain-language security log, not raw rows) to super_admin only.
-- Written defensively (if not exists / conditional insert) in case this
-- was already applied in an earlier session.
-- =========================================================
create table if not exists blocked_ips (
  ip_address text primary key,
  reason text,
  blocked_by uuid references profiles(id) on delete set null,
  blocked_at timestamptz not null default now()
);
alter table blocked_ips enable row level security;
-- Intentionally no policies — same pattern as login_attempts (0022):
-- only the service-role client (used by the login route and the admin
-- security-log API) can read or write this table.

insert into permissions (key, description)
select 'security.manage', 'View the security log and block suspicious IPs — super admin only'
where not exists (select 1 from permissions where key = 'security.manage');

insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r, permissions p
where r.key = 'super_admin' and p.key = 'security.manage'
and not exists (
  select 1 from role_permissions rp
  join roles r2 on r2.id = rp.role_id
  join permissions p2 on p2.id = rp.permission_id
  where r2.key = 'super_admin' and p2.key = 'security.manage'
);
