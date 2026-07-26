-- =========================================================
-- W1.6 — HAMKOR MIJOZLARI: rekvizit tanlashda PLATFORMA bilan bir xil
-- fair-rotation mantig'i (eng kam ishlatilgan karta ustuvor, tenglikda
-- tasodifiy). telegram_operator_payment_methods'da bu ustun 0053'da
-- qo'shilgan edi — hamkor jadvaliga xuddi shunday qo'shiladi.
-- ("Band"/onlayn tushunchasi hamkor kartalariga tegishli emas — ular
-- xodimga emas, hamkorning o'ziga tegishli, shuning uchun faqat
-- usage_count, busyScore emas.)
-- =========================================================
alter table partner_payment_methods add column if not exists usage_count int not null default 0;
