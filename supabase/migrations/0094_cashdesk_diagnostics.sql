-- =========================================================
-- W3 — IMZO DIAGNOSTIKASI VA KALIT PROTOKOLI
--
-- cashdesk_diagnostic_log — har diagnostika chaqiruvi (Balance sinovi
-- HAM, quruq-rejim (dry-run) yozuvi HAM) shu yerga qayd etiladi.
-- O'CHIRILMAYDI. hash/cashierpass HECH QACHON yozilmaydi (faqat oxirgi
-- 4 belgi — masked_hash/masked_pass — diagnostika/audit uchun).
--
-- site_settings.betcore_cashdesk_signature — imzo/vaqt sozlamalari:
--   - variant: 1-4 (1 = joriy/asosiy retsept, o'zgarmas default)
--   - dt_offset_hours: Balance so'rovidagi `dt` uchun UTC siljishi
--     (0=UTC, 3=Moskva, 5=Toshkent) — birinchi gumondor shu, chunki
--     server o'z vaqtiga yaqinlikni tekshirishi mumkin.
--   - dry_run: true bo'lsa Deposit/Payout so'rovi TO'LIQ shakllanadi va
--     qayd etiladi, lekin JO'NATILMAYDI (standart: false — o'chiq).
-- =========================================================

create table if not exists cashdesk_diagnostic_log (
  id uuid primary key default gen_random_uuid(),
  cashdesk_id uuid references cashdesks(id) on delete set null,
  kind text not null check (kind in ('balance_test', 'dry_run')),
  signature_variant int,
  dt_offset_hours int,
  http_status int,
  response jsonb,
  masked_hash text,
  masked_pass text,
  requested_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_cashdesk_diagnostic_log_created on cashdesk_diagnostic_log(created_at desc);

alter table cashdesk_diagnostic_log enable row level security;
create policy "cashdesk_diagnostic_log read" on cashdesk_diagnostic_log
  for select using (has_permission('cashdesks.manage'));
-- YOZISH faqat server (service role) — client-side insert/update/delete
-- policy YO'Q, shuning uchun tarix o'zgartirilmaydi/o'chirilmaydi.

insert into site_settings (key, value)
values (
  'betcore_cashdesk_signature',
  jsonb_build_object(
    'variant', 1,
    'dt_offset_hours', 0,
    'dry_run', false
  )
)
on conflict (key) do nothing;
