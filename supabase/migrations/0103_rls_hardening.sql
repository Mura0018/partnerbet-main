-- =====================================================================
--  0103 — RLS HIMOYASI (keng policy'larni toraytirish)
--
--  TAMOYIL: pul va huquqqa tegadigan har qanday yozuv FAQAT server
--  marshruti (service role, RLS'dan o'tadi) orqali. Brauzerga o'qish va
--  zararsiz maydonlar qoladi. Har bo'lim oldidan audit qilingan: brauzer
--  shu jadvalga qayerda yozadi (hisobotda jadval).
--
--  Qayta ishga tushirishga chidamli: har policy oldidan drop policy if
--  exists; funksiyalar create or replace; trigger drop if exists.
--
--  DEPLOY TARTIBI: avval KOD (fix/rls-hardening), keyin shu migratsiya.
--  Aksincha bo'lsa faqat murojaatni "o'z zimmasiga olish" (support claim)
--  vaqtincha jim ishlamay qoladi — 5-bo'limga qarang.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1) telegram_orders — operator brauzerdan YOZA OLMASIN, o'qish qoladi.
--    Audit: brauzerdan birorta ham insert/update/delete yo'q; barcha
--    amallar app/api/admin/telegram-orders/* (service role) orqali —
--    atomik qulf, urinishlar auditi, payout->to'lov tartibi o'sha yerda.
--    O'qish: SupportTab bog'langan buyurtma kartasi (brauzer select).
-- ---------------------------------------------------------------------
drop policy if exists "telegram_orders.manage full access" on telegram_orders;
drop policy if exists "telegram_orders.manage read" on telegram_orders;
create policy "telegram_orders.manage read" on telegram_orders
  for select using (has_permission('telegram_orders.manage'));
