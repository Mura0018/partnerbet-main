-- =========================================================
-- 0002 — ROLES & PERMISSIONS (normalized RBAC)
-- Seed data here is structural (role/permission definitions), not content.
-- =========================================================
create table roles (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,              -- 'super_admin' | 'admin' | 'editor' | 'user'
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_roles_updated_at before update on roles
  for each row execute function public.set_updated_at();

create table permissions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,              -- e.g. 'posts.manage'
  description text,
  created_at timestamptz not null default now()
);

create table role_permissions (
  role_id uuid not null references roles(id) on delete cascade,
  permission_id uuid not null references permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);
create index idx_role_permissions_permission on role_permissions(permission_id);

-- ---------- Seed: base roles ----------
insert into roles (key, name, description) values
  ('super_admin', 'Super Admin', 'Full control: content, settings, users, roles, logs'),
  ('admin',       'Admin',       'Full content & settings control, cannot manage roles/permissions'),
  ('editor',      'Editor',      'Can create and edit content only, no settings/users/ads access'),
  ('user',        'User',        'Base authenticated visitor account (future public features)');

-- ---------- Seed: permission catalogue ----------
insert into permissions (key, description) values
  ('posts.manage',           'Create, edit, delete, publish blog posts'),
  ('football_news.manage',   'Create, edit, delete, publish football news'),
  ('match_insights.manage',  'Create, edit, delete match insights'),
  ('promotions.manage',      'Manage promo codes'),
  ('apk.manage',             'Manage APK releases'),
  ('advertisements.manage',  'Manage banners / ads / embeds'),
  ('media.manage',           'Upload / delete media library files'),
  ('taxonomy.manage',        'Manage categories & tags'),
  ('faqs.manage',            'Manage FAQ entries'),
  ('navigation.manage',      'Manage header/footer navigation'),
  ('settings.manage',        'Manage site-wide settings (SEO, theme, contact, social, hero)'),
  ('support.manage',         'View and respond to support conversations'),
  ('users.manage',           'View and change roles of other users'),
  ('roles.manage',           'Create/edit roles and permission assignments'),
  ('logs.view',              'View audit logs');

-- ---------- Seed: role -> permission mapping ----------
-- super_admin: every permission
insert into role_permissions (role_id, permission_id)
select (select id from roles where key = 'super_admin'), id from permissions;

-- admin: everything except roles.manage
insert into role_permissions (role_id, permission_id)
select (select id from roles where key = 'admin'), id
from permissions where key <> 'roles.manage';

-- editor: content-creation permissions only
insert into role_permissions (role_id, permission_id)
select (select id from roles where key = 'editor'), id
from permissions
where key in ('posts.manage', 'football_news.manage', 'match_insights.manage', 'media.manage');

-- user: no admin permissions (intentionally none inserted)
