-- =====================================================================
--  KOP KASSA — 3-BOSQICH: BALANS TENGLASHTIRISH
--  Buyurtma qaysi kassaga tegishli ekanini saqlash. Yangi (egasiz) mijoz
--  buyurtmasi balansi eng kam aktiv kassaga; egasi bор mijoz owner
--  operator kassasiga (server tomonda tanlanadi). Bo'sh (null) bo'lsa
--  bajarilishда default kassa ishlatiladi (orqaga moslik).
-- =====================================================================

alter table telegram_orders
  add column if not exists cashdesk_id uuid references cashdesks(id) on delete set null;

create index if not exists idx_telegram_orders_cashdesk on telegram_orders(cashdesk_id, status);
