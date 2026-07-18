-- =========================================================
-- 0020 — PHASE 1 VERIFICATION FIXES
-- Found during the Phase 1 verification pass (see DATABASE_TEST_REPORT.md
-- and SECURITY_REPORT.md). Applied as a new migration rather than editing
-- migration history, per standard practice.
-- =========================================================

-- ---------------------------------------------------------------
-- FIX 1 — audit_trigger() requires a NEW/OLD.id column. profiles, roles
-- and permissions all have one, but were missing the trigger entirely —
-- meaning role changes and permission-catalogue edits were NOT being
-- logged. These are the most security-sensitive tables in the whole
-- schema, so this was a real gap.
-- ---------------------------------------------------------------
create trigger trg_audit_profiles
  after insert or update or delete on profiles
  for each row execute function public.audit_trigger();

create trigger trg_audit_roles
  after insert or update or delete on roles
  for each row execute function public.audit_trigger();

create trigger trg_audit_permissions
  after insert or update or delete on permissions
  for each row execute function public.audit_trigger();

-- ---------------------------------------------------------------
-- FIX 2 — role_permissions has a composite primary key (role_id,
-- permission_id), not an `id` column, so the generic audit_trigger()
-- would fail at runtime ("record new has no field id") if attached
-- directly. A dedicated composite-key variant is used instead so that
-- privilege-grant changes (e.g. removing roles.manage from admin) are
-- still fully audited.
-- ---------------------------------------------------------------
create or replace function public.audit_trigger_composite_key()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'DELETE') then
    insert into audit_logs (actor_id, action, table_name, old_data)
    values (auth.uid(), 'DELETE', tg_table_name, to_jsonb(old));
    return old;
  elsif (tg_op = 'INSERT') then
    insert into audit_logs (actor_id, action, table_name, new_data)
    values (auth.uid(), 'INSERT', tg_table_name, to_jsonb(new));
    return new;
  end if;
  return null;
end;
$$;

create trigger trg_audit_role_permissions
  after insert or delete on role_permissions
  for each row execute function public.audit_trigger_composite_key();

-- ---------------------------------------------------------------
-- FIX 3 — roles / permissions / role_permissions were readable by ANY
-- authenticated account (auth.role() = 'authenticated'). Phase 2 will
-- introduce plain public "user" accounts, which should NOT be able to
-- read the internal permission/role structure. Tightened to
-- is_admin_user() (true only for accounts whose role actually grants at
-- least one admin permission).
-- ---------------------------------------------------------------
drop policy "authenticated read roles" on roles;
create policy "admins read roles" on roles
  for select using (is_admin_user());

drop policy "authenticated read permissions" on permissions;
create policy "admins read permissions" on permissions
  for select using (is_admin_user());

drop policy "authenticated read role_permissions" on role_permissions;
create policy "admins read role_permissions" on role_permissions
  for select using (is_admin_user());

-- ---------------------------------------------------------------
-- FIX 4 — post_tags was readable by literally anyone with no check that
-- the associated post is actually published. This let an outside caller
-- discover tag associations (post_id + tag_id pairs) for DRAFT/unpublished
-- posts by querying the table directly, bypassing the posts table's own
-- "published only" public policy (low-severity info leak, but a real gap).
-- ---------------------------------------------------------------
drop policy "public read post_tags" on post_tags;
create policy "public read post_tags of published posts" on post_tags
  for select using (
    exists (
      select 1 from posts p
      where p.id = post_tags.post_id
        and p.status = 'published'
        and p.deleted_at is null
    )
  );

-- ---------------------------------------------------------------
-- FIX 5 — support_conversations / support_messages allowed an anonymous
-- visitor to INSERT with check(true), meaning anyone could set
-- status = 'resolved', assign an arbitrary assigned_admin_id, or — most
-- seriously — insert a message with sender = 'admin' into ANY conversation
-- id, spoofing a fake admin reply. Insert policies are now scoped to only
-- the fields a real visitor should be able to set.
-- ---------------------------------------------------------------
drop policy "anon insert conversation" on support_conversations;
create policy "anon insert open conversation" on support_conversations
  for insert with check (status = 'open' and assigned_admin_id is null);

drop policy "anon insert message" on support_messages;
create policy "anon insert visitor message" on support_messages
  for insert with check (sender = 'visitor');
