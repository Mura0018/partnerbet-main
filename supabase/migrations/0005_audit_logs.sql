-- =========================================================
-- 0005 — AUDIT LOGS
-- Automatic, tamper-resistant change history for every sensitive table.
-- Rows are written by a SECURITY DEFINER trigger, never by the app
-- directly — no role (not even admins) gets INSERT/UPDATE/DELETE on
-- this table, only logs.view holders may read it.
-- =========================================================
create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles(id) on delete set null,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  table_name text not null,
  record_id uuid,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

-- BRIN index: ideal for large, append-only, time-ordered tables (millions
-- of rows) — far smaller and faster to maintain here than a btree.
create index idx_audit_logs_created_at_brin on audit_logs using brin (created_at);
create index idx_audit_logs_table_record on audit_logs (table_name, record_id);
create index idx_audit_logs_actor on audit_logs (actor_id);

create or replace function public.audit_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'DELETE') then
    insert into audit_logs (actor_id, action, table_name, record_id, old_data)
    values (auth.uid(), 'DELETE', tg_table_name, old.id, to_jsonb(old));
    return old;
  elsif (tg_op = 'UPDATE') then
    insert into audit_logs (actor_id, action, table_name, record_id, old_data, new_data)
    values (auth.uid(), 'UPDATE', tg_table_name, new.id, to_jsonb(old), to_jsonb(new));
    return new;
  elsif (tg_op = 'INSERT') then
    insert into audit_logs (actor_id, action, table_name, record_id, new_data)
    values (auth.uid(), 'INSERT', tg_table_name, new.id, to_jsonb(new));
    return new;
  end if;
  return null;
end;
$$;

alter table audit_logs enable row level security;
create policy "logs.view read audit_logs" on audit_logs
  for select using (has_permission('logs.view'));
-- Intentionally no insert/update/delete policy for any role: only the
-- SECURITY DEFINER trigger function can write here.
