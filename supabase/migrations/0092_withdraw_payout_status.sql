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

-- MUHIM ORQAGA-MOSLIK: eski oqimda yaratilgan buyurtmalarda payout_done=true
-- allaqachon bor (pul haqiqatan ketgan), lekin yangi payout_status ustuni
-- ularда standart 'none' bilan qoladi — bu holda ular YANGI qattiq qoida
-- bo'yicha (withdraw completion payout_status='success' talab qiladi)
-- to'satdan bloklanib qolardi. Shu SATRLARNI 'success'ga backfill qilamiz.
update telegram_orders
set payout_status = 'success', payout_at = coalesce(payout_at, updated_at, created_at)
where payout_done = true and payout_status = 'none';
