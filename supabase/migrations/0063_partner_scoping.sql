-- =====================================================================
--  BOSQICH 7.3b — mijoz "uyi" (partner_id) + buyurtma egasi (partner_id)
--  Kirish qoidasi: bizning app hammaga ochiq; hamkor app faqat o'z mijoziga.
--  Eski qatorlar partner_id = NULL (= biz/platforma) — buzilmaydi.
-- =====================================================================
alter table customers add column if not exists partner_id uuid references partners(id) on delete set null;
alter table telegram_orders add column if not exists partner_id uuid references partners(id) on delete set null;
create index if not exists idx_orders_partner on telegram_orders(partner_id);
