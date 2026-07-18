-- =========================================================
-- 0003 — PROFILES (1:1 extension of auth.users)
-- Replaces the old "admin_profiles" table with a unified profile
-- for every authenticated user (admins today, public users in Phase 2+).
-- =========================================================
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role_id uuid not null references roles(id),
  full_name text,
  avatar_url text,
  is_active boolean not null default true,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_profiles_role_id on profiles(role_id);

create trigger trg_profiles_updated_at before update on profiles
  for each row execute function public.set_updated_at();

-- Auto-create a base "user" profile whenever a new Supabase auth account is
-- created. Admin roles are never self-assigned — an existing super_admin
-- must promote the account afterwards (see README / DB docs).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role_id, full_name)
  values (
    new.id,
    (select id from public.roles where key = 'user'),
    new.raw_user_meta_data ->> 'full_name'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
