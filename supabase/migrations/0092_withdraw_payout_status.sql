-- =========================================================
-- W2.3 — PAYOUT IDEMPOTENTLIGI (buyurtma darajasida holat mashinasi)
-- payout_status: 'none' (hali urinilmagan/qayta urinishga tayyor) ->
-- 'pending' (hozir bajarilmoqda, ATOMIK lock) -> 'success' (pul ketdi,
-- qaytarilmaydi) yoki -> (muvaffaqiyatsiz bo'lsa qaytadan 'none'ga —
-- kod eskirgan holat, W2.4) / 'failed' (transport-darajasidagi xato,
-- qo'lda tekshiruv kerak).
-- payout_attempts — necha marta urinilgani (counter, oddiy son — bu
-- payout_attempts JADVALI (0093) bilan ADASHTIRMASLIK: bu yerdagi ustun
-- faqat tezkor hisoblagich, o'sha jadval esa to'liq audit tarixi).
-- payout_response — oxirgi urinishning xom API javobi (jsonb, diagnostika).
-- payout_at — oxirgi muvaffaqiyatli/muvaffaqiyatsiz urinish vaqti.
-- =========================================================
alter table telegram_orders add column if not exists payout_status text not null default 'none'
  check (payout_status in ('none', 'pending', 'success', 'failed'));
alter table telegram_orders add column if not exists payout_attempts int not null default 0;
alter table telegram_orders add column if not exists payout_response jsonb;
alter table telegram_orders add column if not exists payout_at timestamptz;
