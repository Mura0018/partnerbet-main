-- =====================================================================
--  ISBOT SKRIPTI — #11, #12, #13, #16 (Bosqich 3, 2026-07-25)
--  BU MIGRATSIYA EMAS. Faqat SELECT — hech narsa yozmaydi, o'zgartirmaydi,
--  o'chirmaydi. Supabase SQL Editor'da qo'lda ishga tushiring, natijani
--  (har blokning jadvalini) menga qaytaring — men "Eski | Yangi | Farq"
--  jadvalini shundan to'ldiraman.
--
--  Nima isbotlanadi:
--  A) #11/#12 — dashboard eski (mijoz-tomon .limit(20000) uslubi) va
--     yangi (to'liq SQL agregat, betcore_financial_report bilan bir xil)
--     kirim/chiqim/komissiya sonlari — oxirgi 30 kun va oxirgi 12 oy.
--  B) #13 — mijozlar sahifasidagi buyurtma soni: eski (limit(20000)
--     bitta so'rov) va yangi (har mijoz uchun to'g'ri COUNT).
--  C) #16 — buyurtmalar ro'yxati: eski (oxirgi 200 tadan tashqarida
--     qolgan qatorlar soni) — bu "topilmaydigan" qatorlar sonini
--     ko'rsatadi.
--
--  ESLATMA (A uchun): eski mijoz-tomon so'rov `.order()` YO'Q holda
--  `.limit(20000)` chaqirardi — Postgres ORDER BY'siz LIMIT tartibini
--  KAFOLATLAMAYDI. Amalda deyarli har doim yozilish tartibiga yaqin
--  (eng eski yozuvlar avval) natija beradi, shuning uchun quyida ham
--  "ESKI" ustuni `order by created_at asc limit N` bilan taqlid
--  qilinadi — bu ENG YAQIN, lekin 100% kafolatlangan emas taqlid.
-- =====================================================================


-- =====================================================================
-- A) #11/#12 — DASHBOARD: eski (limit-taqlid) vs yangi (to'liq agregat)
-- =====================================================================

-- A1) Davr chegaralari (o'zgartirmang — pastdagi barcha so'rovlar shundan foydalanadi)
--     :p30_start / :p12m_start o'rniga aniq sanalarni har so'rovga qo'lda yozamiz
--     (Supabase SQL Editor psql parametrlarini qo'llab-quvvatlamaydi).

-- ---- OXIRGI 30 KUN ----
with bounds as (
  select now() - interval '30 days' as p_start, now() as p_end
),
-- Jadvaldagi haqiqiy qator soni (davr ichida) — agar bu 20000 dan kam
-- bo'lsa, ESKI usul HALI hech narsani yo'qotmaydi (bug lurking, hali
-- ko'rinmagan); ko'p bo'lsa — pastdagi ESKI/YANGI sonlar farq qiladi.
row_count as (
  select count(*) as n from telegram_orders, bounds where created_at >= bounds.p_start and created_at < bounds.p_end
),
-- ESKI: faqat "birinchi" 20000 qator (created_at asc taqlid) ustida hisoblanadi
old_limited as (
  select type, status, amount from telegram_orders, bounds
  where created_at >= bounds.p_start and created_at < bounds.p_end
  order by created_at asc
  limit 20000
),
old_calc as (
  select
    count(*) filter (where status='completed')                                as completed_count,
    count(*) filter (where status='rejected')                                 as rejected_count,
    coalesce(sum(amount) filter (where status='completed'),0)                 as volume,
    count(*) filter (where status='completed' and type='topup')               as topup_count,
    count(*) filter (where status='completed' and type='withdraw')            as withdraw_count,
    coalesce(sum(amount) filter (where status='completed' and type='topup'),0)    as topup_volume,
    coalesce(sum(amount) filter (where status='completed' and type='withdraw'),0) as withdraw_volume
  from old_limited
),
-- YANGI: betcore_financial_report ISHLATADIGAN aynan shu SQL (limit yo'q)
new_calc as (
  select
    (select count(*) from telegram_orders, bounds where created_at>=bounds.p_start and created_at<bounds.p_end and status='completed') as completed_count,
    (select count(*) from telegram_orders, bounds where created_at>=bounds.p_start and created_at<bounds.p_end and status='rejected')  as rejected_count,
    (select coalesce(sum(amount),0) from telegram_orders, bounds where created_at>=bounds.p_start and created_at<bounds.p_end and status='completed') as volume,
    (select count(*) from telegram_orders, bounds where created_at>=bounds.p_start and created_at<bounds.p_end and status='completed' and type='topup') as topup_count,
    (select count(*) from telegram_orders, bounds where created_at>=bounds.p_start and created_at<bounds.p_end and status='completed' and type='withdraw') as withdraw_count,
    (select coalesce(sum(amount),0) from telegram_orders, bounds where created_at>=bounds.p_start and created_at<bounds.p_end and status='completed' and type='topup') as topup_volume,
    (select coalesce(sum(amount),0) from telegram_orders, bounds where created_at>=bounds.p_start and created_at<bounds.p_end and status='completed' and type='withdraw') as withdraw_volume
)
select
  '30 kun' as davr,
  (select n from row_count) as jami_qator_davrda,
  o.completed_count as eski_completed, n.completed_count as yangi_completed,
  o.rejected_count as eski_rejected, n.rejected_count as yangi_rejected,
  o.volume as eski_volume, n.volume as yangi_volume,
  o.topup_count as eski_topup_count, n.topup_count as yangi_topup_count,
  o.withdraw_count as eski_withdraw_count, n.withdraw_count as yangi_withdraw_count,
  o.topup_volume as eski_topup_volume, n.topup_volume as yangi_topup_volume,
  o.withdraw_volume as eski_withdraw_volume, n.withdraw_volume as yangi_withdraw_volume
from old_calc o, new_calc n;

-- ---- OXIRGI 12 OY ----
with bounds as (
  select now() - interval '12 months' as p_start, now() as p_end
),
row_count as (
  select count(*) as n from telegram_orders, bounds where created_at >= bounds.p_start and created_at < bounds.p_end
),
old_limited as (
  select type, status, amount from telegram_orders, bounds
  where created_at >= bounds.p_start and created_at < bounds.p_end
  order by created_at asc
  limit 20000
),
old_calc as (
  select
    count(*) filter (where status='completed')                                as completed_count,
    count(*) filter (where status='rejected')                                 as rejected_count,
    coalesce(sum(amount) filter (where status='completed'),0)                  as volume,
    count(*) filter (where status='completed' and type='topup')               as topup_count,
    count(*) filter (where status='completed' and type='withdraw')            as withdraw_count,
    coalesce(sum(amount) filter (where status='completed' and type='topup'),0)    as topup_volume,
    coalesce(sum(amount) filter (where status='completed' and type='withdraw'),0) as withdraw_volume
  from old_limited
),
new_calc as (
  select
    (select count(*) from telegram_orders, bounds where created_at>=bounds.p_start and created_at<bounds.p_end and status='completed') as completed_count,
    (select count(*) from telegram_orders, bounds where created_at>=bounds.p_start and created_at<bounds.p_end and status='rejected')  as rejected_count,
    (select coalesce(sum(amount),0) from telegram_orders, bounds where created_at>=bounds.p_start and created_at<bounds.p_end and status='completed') as volume,
    (select count(*) from telegram_orders, bounds where created_at>=bounds.p_start and created_at<bounds.p_end and status='completed' and type='topup') as topup_count,
    (select count(*) from telegram_orders, bounds where created_at>=bounds.p_start and created_at<bounds.p_end and status='completed' and type='withdraw') as withdraw_count,
    (select coalesce(sum(amount),0) from telegram_orders, bounds where created_at>=bounds.p_start and created_at<bounds.p_end and status='completed' and type='topup') as topup_volume,
    (select coalesce(sum(amount),0) from telegram_orders, bounds where created_at>=bounds.p_start and created_at<bounds.p_end and status='completed' and type='withdraw') as withdraw_volume
)
select
  '12 oy' as davr,
  (select n from row_count) as jami_qator_davrda,
  o.completed_count as eski_completed, n.completed_count as yangi_completed,
  o.rejected_count as eski_rejected, n.rejected_count as yangi_rejected,
  o.volume as eski_volume, n.volume as yangi_volume,
  o.topup_count as eski_topup_count, n.topup_count as yangi_topup_count,
  o.withdraw_count as eski_withdraw_count, n.withdraw_count as yangi_withdraw_count,
  o.topup_volume as eski_topup_volume, n.topup_volume as yangi_topup_volume,
  o.withdraw_volume as eski_withdraw_volume, n.withdraw_volume as yangi_withdraw_volume
from old_calc o, new_calc n;

-- A2) StaffActivity (#12) — operator jadvali eski (limit 20000/30000) vs
--     yangi (limitsiz) — jami qatorlar soni, limitdan oshganini ko'rsatadi.
select
  (select count(*) from telegram_orders where status='completed') as jami_completed_orders,
  20000 as eski_orders_limit,
  (select count(*) from telegram_support_messages where sender='operator') as jami_operator_javoblari,
  30000 as eski_messages_limit,
  case when (select count(*) from telegram_orders where status='completed') > 20000
       then 'HA — StaffActivity buyurtma soni kesilishi MUMKIN' else 'yo''q — hali kesilmagan' end as orders_xulosa,
  case when (select count(*) from telegram_support_messages where sender='operator') > 30000
       then 'HA — StaffActivity javoblar soni kesilishi MUMKIN' else 'yo''q — hali kesilmagan' end as messages_xulosa;


-- =====================================================================
-- B) #13 — MIJOZLAR RO'YXATI: buyurtma soni (eski limit(20000) vs yangi COUNT)
-- =====================================================================

-- Eng yangi 50 mijoz (customers/route.ts standart 1-sahifasi, hidden=false)
with page as (
  select id from customers where is_hidden = false order by created_at desc limit 50
),
old_limited as (
  -- ESKI: shu 50 mijozning buyurtmalari, LEKIN 20000 tagacha kesilgan
  select customer_id from telegram_orders where customer_id in (select id from page) limit 20000
),
old_counts as (
  select customer_id, count(*) as eski_soni from old_limited group by customer_id
),
new_counts as (
  -- YANGI: har mijoz uchun to'g'ri COUNT (limit yo'q)
  select id as customer_id, (select count(*) from telegram_orders t where t.customer_id = page.id) as yangi_soni
  from page
)
select
  n.customer_id,
  coalesce(o.eski_soni, 0) as eski_soni,
  n.yangi_soni,
  n.yangi_soni - coalesce(o.eski_soni, 0) as farq
from new_counts n
left join old_counts o on o.customer_id = n.customer_id
order by farq desc, n.yangi_soni desc
limit 20;
-- Agar barcha "farq" ustuni 0 bo'lsa — bug hali amalda ko'rinmagan (jami
-- buyurtmalar soni 20000 dan kam), lekin kod endi tuzatilgan holda qoladi.


-- =====================================================================
-- C) #16 — BUYURTMALAR RO'YXATI: "birinchi 200"dan tashqarida qolganlar
-- =====================================================================

-- Har status uchun: jami son, 200 dan oshgan-oshmaganini va ESKI usulda
-- ko'rinmaydigan (200-tadan eski) qatorlar sonini ko'rsatadi.
with ranked as (
  select id, status, created_at,
         row_number() over (partition by status order by created_at desc) as rn
  from telegram_orders
)
select
  status,
  count(*) as jami_soni,
  count(*) filter (where rn <= 200) as eski_usulda_korinadigan,
  count(*) filter (where rn > 200) as eski_usulda_KORINMAYDIGAN
from ranked
group by status
order by status;
-- "eski_usulda_KORINMAYDIGAN" > 0 bo'lgan status — operator o'sha statusda
-- eski buyurtmani qidiruv/filtr bilan TOPA OLMAGAN (search/operatorFilter/
-- onlyToday/onlyUnclaimed hech biri bu qatorlarga yetib bormagan).
