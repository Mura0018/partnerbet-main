-- =====================================================================
--  0104 — OPERATOR <-> MIJOZ CHATI: tizim xabarlari, bir martalik
--  ogohlantirishlar, operator bildirishnomasi throttle'i.
--
--  Qayta ishga tushirishga chidamli: add column if not exists,
--  drop constraint if exists.
--
--  DEPLOY TARTIBI: avval SHU migratsiya, keyin kod (feat/support-chat).
--  Kod migratsiyasiz ham ishlaydi (guarded fallback): tizim xabarlari va
--  bir martalik ogohlantirishlar migratsiya qo'yilguncha yuborilmaydi,
--  qolgan oqim (yozish, media, yakunlash) avvalgidek.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1) Tizim xabarlari (1.2) — "jamoaga yo'naltirildi", salomlashuv va h.k.
--    endi hech kimning nomidan emas: sender='operator', is_system=true,
--    operator_id NULL bo'lishi mumkin. Avval chk_operator_id_shape
--    operator_id talab qilardi -> kod tasodifiy faol profilni qo'yardi,
--    salomlashuv esa (operator_id'siz) jimgina rad etilardi.
--    is_system haqiqiy operator javobini avto-xabardan ajratadi
--    (statistika, "javob berildi" belgisi, javobsizlik hisobi).
-- ---------------------------------------------------------------------
alter table telegram_support_messages
  add column if not exists is_system boolean not null default false;

alter table telegram_support_messages drop constraint if exists chk_operator_id_shape;
alter table telegram_support_messages add constraint chk_operator_id_shape check (
  (sender = 'operator' and (operator_id is not null or is_system))
  or sender = 'customer'
);

-- Sxema tafovuti: kod (mini app support POST/GET) order_id ustunini
-- ishlatadi, lekin uni yaratadigan migratsiya yo'q edi. Jonli bazada
-- qo'lda qo'shilgan bo'lsa — bu qator hech narsa qilmaydi.
alter table telegram_support_messages
  add column if not exists order_id uuid references telegram_orders(id) on delete set null;


-- ---------------------------------------------------------------------
-- 2) Bir martalik "operator band / jamoaga yo'naltirildi" ogohlantirishi
--    (1.1). Avval mijozning HAR xabarida yangi ogohlantirish qo'shilardi.
--    Atomik shartli update (busy_notified_at is null -> now) — faqat
--    yozuvi muvaffaqiyatli bo'lgan so'rov xabar yuboradi. Operator javob
--    berganda yoki suhbat yakunlanganda NULL ga qaytariladi.
-- ---------------------------------------------------------------------
alter table telegram_support_threads
  add column if not exists busy_notified_at timestamptz;


-- ---------------------------------------------------------------------
-- 3) Operatorga Telegram bildirishnomasi throttle'i (2.1). Mijoz yozganda
--    atomik shartli update (null yoki 10 daqiqadan eski -> now) — qisqa
--    oraliqda bitta xabar. Operator javob berganda NULL (hisob qaytadan).
-- ---------------------------------------------------------------------
alter table telegram_support_threads
  add column if not exists operator_notified_at timestamptz;
