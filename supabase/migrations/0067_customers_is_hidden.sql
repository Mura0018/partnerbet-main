-- =====================================================================
--  Mijozni admin ro'yxatidan YASHIRISH (soft-hide). FAQAT admin ko'rinishi
--  uchun — mijoz app oqimiga (login/orders) ta'sir qilmaydi. Ma'lumot o'chmaydi.
-- =====================================================================
alter table customers add column if not exists is_hidden boolean not null default false;
