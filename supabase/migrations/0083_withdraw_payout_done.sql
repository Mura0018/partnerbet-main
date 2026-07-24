-- =====================================================================
--  WITHDRAW A-OQIMI — pul 1xbetдан ERTA (mijoz kod kiritganda) tortiladi.
--  payout_done=true bo'lса, Payout allaqachon bajarilgan (1xbetдан kassaга
--  pul tushgan). Operator "Bajarildi" bosganда status route QAYTA Payout
--  chaqirмаsligi kerak (ikki marta pul chiqmasin). payout_summa = API
--  qaytarган haqiqий miqdor (kod ichидаги).
-- =====================================================================

alter table telegram_orders add column if not exists payout_done boolean not null default false;
alter table telegram_orders add column if not exists payout_summa numeric(14,2);
