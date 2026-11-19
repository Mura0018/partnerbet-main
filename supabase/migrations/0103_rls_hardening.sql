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


-- ---------------------------------------------------------------------
-- 2) profiles — ustun-qo'riqchi trigger (policy'lar o'zgarmaydi).
--    Nega policy emas: brauzer o'z qatorida zararsiz maydonlarni yozadi
--    (is_busy, is_online, chat_theme, display_name, avatar_url, ...) va
--    users.manage admin boshqa xodim qatorida is_active / full_name /
--    telegram_region ni yozadi. RLS ustunlarni cheklay olmaydi, shuning
--    uchun mavjud prevent_self_role_escalation naqshi kengaytirildi:
--    foydalanuvchi sessiyasidan (auth.uid() not null) kelgan UPDATE'da
--    xavfli ustunlar JIMGINA eski qiymatiga qaytariladi (xato emas —
--    mavjud brauzer kodi buzilmaydi). Service role / SQL editor
--    (auth.uid() is null) — cheklovsiz.
--
--    Hech kim (users.manage ham) brauzerdan o'zgartira olmaydi:
--      role_id (canAssignRole'ni chetlab o'tmaslik uchun — change-role
--      marshruti service role), rating, telegram_chat_id,
--      telegram_link_code, telegram_link_code_expires_at, created_at,
--      last_login_at.
--    O'z qatorida o'zgartira olmaydi (admin boshqa xodimga qila oladi):
--      is_active (chetlatilgan xodim o'zini qayta faollashtira olmasin),
--      telegram_region.
-- ---------------------------------------------------------------------
create or replace function public.guard_profile_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new; -- service role yoki SQL editor
  end if;

  new.role_id := old.role_id;
  new.rating := old.rating;
  new.telegram_chat_id := old.telegram_chat_id;
  new.telegram_link_code := old.telegram_link_code;
  new.telegram_link_code_expires_at := old.telegram_link_code_expires_at;
  new.created_at := old.created_at;
  new.last_login_at := old.last_login_at;

  if new.id = auth.uid() then
    new.is_active := old.is_active;
    new.telegram_region := old.telegram_region;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_profile_privileged_columns on profiles;
create trigger trg_guard_profile_privileged_columns
  before update on profiles
  for each row execute function public.guard_profile_privileged_columns();

-- apply_operator_rating — SECURITY DEFINER, ichida ruxsat tekshiruvi yo'q va
-- EXECUTE standart holatda PUBLIC: har kim RPC orqali istalgan operator
-- reytingini o'zgartira olardi. Yagona chaqiruvchi — service role
-- (lib/cashdesk/oversight.ts), shuning uchun boshqalardan olib qo'yiladi.
revoke execute on function public.apply_operator_rating(uuid, int, uuid, text) from public, anon, authenticated;
grant execute on function public.apply_operator_rating(uuid, int, uuid, text) to service_role;


-- ---------------------------------------------------------------------
-- 3) push_subscriptions — anonim/brauzer yozishi yopiladi.
--    Audit: subscribe (upsert) va sendPush 404/410 tozalash allaqachon
--    service role; unsubscribe ham service role'ga ko'chirildi (shu
--    branch). Avval delete using (true) — har kim istalgan obunani
--    o'chira olardi. Admin sanog'i (settings.manage SELECT) qoladi.
-- ---------------------------------------------------------------------
drop policy if exists "public insert subscription" on push_subscriptions;
drop policy if exists "public delete own subscription" on push_subscriptions;


-- ---------------------------------------------------------------------
-- 4) global_chat_messages — is_system faqat server, partner_id esa
--    yozuvchining o'z partneriga bog'langan.
--    Audit: yagona yozuvchi lib/chat/GlobalChat.tsx (brauzer insert):
--    message, sender_id = auth user, partner_id = current_partner_id()
--    (platforma xodimida null), is_system yuborilmaydi (default false) —
--    yangi shartdan o'tadi, kod o'zgarmaydi. Avval WITH CHECK faqat
--    sender_id = auth.uid() edi: istalgan kirgan foydalanuvchi boshqa
--    partner nomidan yoki is_system=true bilan yoza olardi.
-- ---------------------------------------------------------------------
drop policy if exists "write global chat" on global_chat_messages;
create policy "write global chat" on global_chat_messages
  for insert with check (
    sender_id = auth.uid()
    and is_system = false
    and (
      (partner_id is not null and partner_id = current_partner_id())
      or (partner_id is null and has_permission('partners.manage'))
    )
  );
