-- =========================================================
-- 0021 — PHASE 2: EXPAND ROLES TO FULL 8-ROLE MATRIX
-- Adds: moderator, support, affiliate_manager, content_manager
-- (super_admin, admin, editor, user already exist from 0002).
-- =========================================================
insert into roles (key, name, description) values
  ('moderator',         'Moderator',         'Moderates match insights, FAQs and support conversations'),
  ('support',           'Support',           'Handles support conversations only'),
  ('affiliate_manager', 'Affiliate Manager', 'Manages promotions, advertisements and APK releases'),
  ('content_manager',   'Content Manager',   'Senior content role: posts, football news, match insights, media, taxonomy, FAQs, navigation');

-- content_manager: broader content oversight than editor (adds taxonomy, faqs, navigation)
insert into role_permissions (role_id, permission_id)
select (select id from roles where key = 'content_manager'), id
from permissions
where key in (
  'posts.manage', 'football_news.manage', 'match_insights.manage',
  'media.manage', 'taxonomy.manage', 'faqs.manage', 'navigation.manage'
);

-- moderator: content moderation + support triage
insert into role_permissions (role_id, permission_id)
select (select id from roles where key = 'moderator'), id
from permissions
where key in ('support.manage', 'match_insights.manage', 'faqs.manage');

-- support: support conversations only
insert into role_permissions (role_id, permission_id)
select (select id from roles where key = 'support'), id
from permissions
where key = 'support.manage';

-- affiliate_manager: monetization-adjacent modules
insert into role_permissions (role_id, permission_id)
select (select id from roles where key = 'affiliate_manager'), id
from permissions
where key in ('promotions.manage', 'advertisements.manage', 'apk.manage');
