-- =====================================================================
--  QR KASSA — 0-BOSQICH: KOD PARTIYALARI (card_batches)
--  Kartalar oldindan PARTIYA bilan chop etiladi (tipografiyaga beriladigan
--  kodlar ro'yxati). Har partiya blank kartalar to'plamini yaratadi (kodlar
--  promo_cards ga status='blank' bilan yoziladi — 0100). Partiya yaratish/
--  boshqarish faqat super_admin (cards.manage).
--
--  Kod GENERATSIYASI (N ta noyob kod) — phase 1 API (uникallik tekshiruvi +
--  tipografiya eksporti). Bu migratsiya faqat SXEMA.
-- =====================================================================
create table card_batches (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  quantity int not null check (quantity > 0),
  note text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table card_batches enable row level security;
-- drop-oldin (0094 naqshi): SQL ikkinchi marta ishga tushirilsa xato bermasin.
drop policy if exists "card_batches manage" on card_batches;
create policy "card_batches manage" on card_batches
  for all using (has_permission('cards.manage')) with check (has_permission('cards.manage'));

-- cards.manage ruxsati -> faqat super_admin
insert into permissions (key, description)
values ('cards.manage', 'QR karta partiyalarini yaratish/boshqarish')
on conflict (key) do nothing;

insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r cross join permissions p
where r.key = 'super_admin' and p.key = 'cards.manage'
on conflict (role_id, permission_id) do nothing;
