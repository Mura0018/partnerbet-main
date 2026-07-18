-- =========================================================
-- 0016 — FAQ
-- =========================================================
create table faqs (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  answer text not null,
  category text,
  position int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index idx_faqs_position on faqs(position) where deleted_at is null;

create trigger trg_faqs_updated_at before update on faqs
  for each row execute function public.set_updated_at();
create trigger trg_audit_faqs
  after insert or update or delete on faqs
  for each row execute function public.audit_trigger();

alter table faqs enable row level security;
create policy "public read active faqs" on faqs
  for select using (is_active = true and deleted_at is null);
create policy "faqs.manage full access" on faqs
  for all using (has_permission('faqs.manage')) with check (has_permission('faqs.manage'));
