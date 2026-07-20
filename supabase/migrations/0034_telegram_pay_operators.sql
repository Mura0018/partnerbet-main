insert into permissions (key, description) values
  ('telegram_orders.manage',    'View and process BetCore Pay topup/withdraw orders'),
  ('telegram_operators.manage', 'Create/edit operator accounts and their regional kassa assignment');

insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r, permissions p
where r.key = 'super_admin' and p.key in ('telegram_orders.manage', 'telegram_operators.manage');

insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r, permissions p
where r.key = 'admin' and p.key in ('telegram_orders.manage', 'telegram_operators.manage');

insert into roles (key, name, description) values
  ('operator', 'Operator', 'Handles BetCore Pay orders for their assigned region only');

insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r, permissions p
where r.key = 'operator' and p.key = 'telegram_orders.manage';

alter table profiles add column telegram_region text;
