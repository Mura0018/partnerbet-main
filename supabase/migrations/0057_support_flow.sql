-- =========================================================
-- 0057 — SUPPORT FLOW: holat, avto-javob, buyurtmaga bog'lash
-- Mijoz-operator suhbatini professional oqimga o'tkazish uchun
-- thread'ga holat va kuzatuv maydonlari qo'shiladi.
-- =========================================================

-- Suhbat holati: 'open' (ochiq/faol), 'ended' (yakunlangan)
alter table telegram_support_threads add column if not exists status text not null default 'open';

-- Kirish avto-xabari yuborildimi (bir marta yuboriladi)
alter table telegram_support_threads add column if not exists auto_greeted boolean not null default false;

-- Suhbat qaysi buyurtmaga bog'langan (mijoz tanlagan buyurtma)
alter table telegram_support_threads add column if not exists linked_order_id uuid references telegram_orders(id) on delete set null;

-- Operator oxirgi marta qachon javob bergani (band/javobsizlikni kuzatish uchun)
alter table telegram_support_threads add column if not exists last_operator_reply_at timestamptz;

-- Mijoz oxirgi marta qachon yozgani
alter table telegram_support_threads add column if not exists last_customer_message_at timestamptz;

-- Suhbat qachon yakunlangani
alter table telegram_support_threads add column if not exists ended_at timestamptz;
