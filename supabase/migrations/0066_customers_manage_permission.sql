-- =====================================================================
--  MIJOZLAR sahifasi uchun yangi ruxsat: customers.manage
--  super_admin + admin ga beriladi. (Kelajakdagi bonus/marketing poydevori.)
-- =====================================================================
insert into permissions (key, description)
values ('customers.manage', 'Mijozlarni ko''rish va boshqarish')
on conflict (key) do nothing;

insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r cross join permissions p
where r.key in ('super_admin', 'admin') and p.key = 'customers.manage'
on conflict (role_id, permission_id) do nothing;
