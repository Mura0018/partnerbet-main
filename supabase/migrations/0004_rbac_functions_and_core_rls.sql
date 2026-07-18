-- =========================================================
-- 0004 — RBAC HELPER FUNCTIONS + RLS FOR ROLES/PERMISSIONS/PROFILES
-- =========================================================

-- Returns true if the currently authenticated user's role has the given
-- permission key. Used in every RLS policy below instead of repeating
-- role-lookup joins everywhere.
create or replace function public.has_permission(perm_key text)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from profiles p
    join role_permissions rp on rp.role_id = p.role_id
    join permissions perm on perm.id = rp.permission_id
    where p.id = auth.uid()
      and p.is_active = true
      and perm.key = perm_key
  );
$$;

-- Returns true if the user has ANY admin-level permission at all — used to
-- gate "can this account even open /admin" checks (middleware, layout).
create or replace function public.is_admin_user()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from profiles p
    join role_permissions rp on rp.role_id = p.role_id
    where p.id = auth.uid()
      and p.is_active = true
  );
$$;

-- ---------- RLS: roles / permissions / role_permissions ----------
-- NOTE: the SELECT policies below are superseded by migration 0020
-- (tightened from "any authenticated user" to "admin accounts only").
-- Kept here unmodified so migration history stays accurate/replayable.
alter table roles enable row level security;
alter table permissions enable row level security;
alter table role_permissions enable row level security;

create policy "authenticated read roles" on roles
  for select using (auth.role() = 'authenticated');
create policy "roles.manage write roles" on roles
  for all using (has_permission('roles.manage')) with check (has_permission('roles.manage'));

create policy "authenticated read permissions" on permissions
  for select using (auth.role() = 'authenticated');
create policy "roles.manage write permissions" on permissions
  for all using (has_permission('roles.manage')) with check (has_permission('roles.manage'));

create policy "authenticated read role_permissions" on role_permissions
  for select using (auth.role() = 'authenticated');
create policy "roles.manage write role_permissions" on role_permissions
  for all using (has_permission('roles.manage')) with check (has_permission('roles.manage'));

-- ---------- RLS: profiles ----------
alter table profiles enable row level security;

-- Everyone can read + update their own profile row.
create policy "self read profile" on profiles
  for select using (id = auth.uid());
create policy "self update profile" on profiles
  for update using (id = auth.uid())
  with check (id = auth.uid());

-- Guard against self-elevation: if the person making the change does NOT
-- hold users.manage, silently keep their role_id unchanged no matter what
-- value they submitted. (A trigger is used instead of an RLS check because
-- RLS CHECK clauses cannot reliably compare NEW vs OLD on the same row.)
create or replace function public.prevent_self_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.id = auth.uid() and not has_permission('users.manage') then
    new.role_id := old.role_id;
  end if;
  return new;
end;
$$;

create trigger trg_prevent_self_role_escalation
  before update on profiles
  for each row execute function public.prevent_self_role_escalation();

-- users.manage holders can read & update anyone's profile (e.g. to change roles).
create policy "users.manage read all profiles" on profiles
  for select using (has_permission('users.manage'));
create policy "users.manage update all profiles" on profiles
  for update using (has_permission('users.manage'))
  with check (has_permission('users.manage'));
