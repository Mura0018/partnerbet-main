-- =========================================================
-- W1.5 — COUNTRY_CODE (poydevor, hozircha ISHLATILMAYDI)
-- Kelajakda ko'p-mamlakat qo'llovi uchun ustunlar oldindan qo'shiladi,
-- shunda keyingi migratsiya faqat kodni ulashdan iborat bo'ladi (og'ir
-- backfill/qayta-loyihalash shart bo'lmaydi). Standart 'UZ' — joriy
-- yagona bozor. Hech qanday mavjud so'rov/RLS/indeks o'zgarmaydi.
-- =========================================================
alter table customers add column if not exists country_code text not null default 'UZ';
alter table cashdesks add column if not exists country_code text not null default 'UZ';
alter table telegram_operator_payment_methods add column if not exists country_code text not null default 'UZ';
alter table partner_payment_methods add column if not exists country_code text not null default 'UZ';
