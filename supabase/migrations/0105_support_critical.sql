-- =====================================================================
--  0105 — SUPPORT CHAT: thread jadvalidan ro'yxat + brauzer yozishini yopish
--
--  Qayta ishga tushirishga chidamli: add column if not exists, create or
--  replace, drop trigger/policy if exists, backfill qayta hisoblaydi.
--  0104 (is_system ustuni) qo'yilgan bo'lishi SHART.
--
--  DEPLOY TARTIBI: istalgan tartib xavfsiz.
--   - Kod oldin: ro'yxat 0105 ustunlari yo'qligini sezib eski usulda
--     (300 xabarlik oyna) quriladi; boshqa hech narsa o'zgarmaydi.
--   - Migratsiya oldin: trigger maydonlarni to'ldirib boradi, eski kod
--     ularni o'qimaydi; 2-bo'lim faqat foydalanilmayotgan brauzer insert
--     policy'sini yopadi (brauzer bu jadvalga yozmaydi — audit).
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1) Ro'yxat uchun thread maydonlari (1-band). Avval operator ro'yxati
--    global 300 xabarlik oynadan qurilardi — faol mijozlar ko'payganda eski
--    suhbatlar ro'yxatdan tushib qolardi. Endi ro'yxat thread'dan:
--      last_message_at      — oxirgi xabar (istalgan) vaqti, saralash;
--      last_message_preview — oxirgi HAQIQIY (tizim emas) xabar matni (200);
--      last_message_kind    — 'text' | 'image' | 'voice';
--      first_unanswered_at  — oxirgi haqiqiy operator javobidan keyingi
--                             eng eski mijoz xabari (null = javob berilgan).
--    Barchasini telegram_support_messages AFTER INSERT trigger'i yuritadi —
--    har bir yozish marshruti (mini app, operator, cron, tizim) qamrab olinadi.
-- ---------------------------------------------------------------------
alter table telegram_support_threads add column if not exists last_message_at timestamptz;
alter table telegram_support_threads add column if not exists last_message_preview text;
alter table telegram_support_threads add column if not exists last_message_kind text;
alter table telegram_support_threads add column if not exists first_unanswered_at timestamptz;

create index if not exists idx_support_threads_list
  on telegram_support_threads(is_archived, last_message_at desc);

create or replace function public.support_thread_track_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Thread yo'q bo'lsa yaratiladi (mijozning birinchi xabari thread upsert'dan
  -- OLDIN yoziladi), bor bo'lsa oxirgi faollik vaqti yangilanadi.
  insert into telegram_support_threads (customer_id, last_message_at)
  values (new.customer_id, new.created_at)
  on conflict (customer_id) do update
    set last_message_at = greatest(coalesce(telegram_support_threads.last_message_at, excluded.last_message_at), excluded.last_message_at);

  -- Tizim xabari (salomlashuv, "band" va h.k.) ko'rinish va javob hisobiga ta'sir qilmaydi.
  if not coalesce(new.is_system, false) then
    update telegram_support_threads
       set last_message_preview = left(coalesce(new.message, ''), 200),
           last_message_kind = case
             when new.image_path is not null then 'image'
             when new.voice_path is not null then 'voice'
             else 'text'
           end,
           first_unanswered_at = case
             when new.sender = 'customer' then coalesce(first_unanswered_at, new.created_at)
             else null
           end
     where customer_id = new.customer_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_support_thread_track_message on telegram_support_messages;
create trigger trg_support_thread_track_message
  after insert on telegram_support_messages
  for each row execute function public.support_thread_track_message();

-- Backfill (mavjud suhbatlar). Xabari bor, lekin thread qatori yo'q mijozlar
-- uchun qator yaratiladi (avval ular ham ro'yxatda ko'rinardi).
insert into telegram_support_threads (customer_id)
select distinct customer_id from telegram_support_messages
on conflict (customer_id) do nothing;

update telegram_support_threads t
   set last_message_at = m.max_at
  from (select customer_id, max(created_at) as max_at
          from telegram_support_messages
         group by customer_id) m
 where m.customer_id = t.customer_id;

update telegram_support_threads t
   set last_message_preview = left(coalesce(m.message, ''), 200),
       last_message_kind = case
         when m.image_path is not null then 'image'
         when m.voice_path is not null then 'voice'
         else 'text'
       end
  from (select distinct on (customer_id) customer_id, message, image_path, voice_path
          from telegram_support_messages
         where not is_system
         order by customer_id, created_at desc) m
 where m.customer_id = t.customer_id;

update telegram_support_threads set first_unanswered_at = null;
update telegram_support_threads t
   set first_unanswered_at = x.first_at
  from (select m.customer_id, min(m.created_at) as first_at
          from telegram_support_messages m
          left join (select customer_id, max(created_at) as last_reply
                       from telegram_support_messages
                      where sender = 'operator' and not is_system
                      group by customer_id) r on r.customer_id = m.customer_id
         where m.sender = 'customer'
           and (r.last_reply is null or m.created_at > r.last_reply)
         group by m.customer_id) x
 where x.customer_id = t.customer_id;


-- ---------------------------------------------------------------------
-- 2) telegram_support_messages — brauzerdan YOZISH yopiladi (2-band).
--    Audit: foydalanuvchi sessiyasi bilan bu jadvalga yozadigan joy YO'Q —
--    SupportTab faqat o'qiydi; barcha yozuvlar (mijoz mini app, operator
--    javobi/ovozi, yakunlash, o'chirish, tizim xabarlari) service role
--    marshrutlari orqali. 0036 dagi insert policy'si 0103 da yopilmay qolgan
--    edi: tizimga kirgan xodim konsoldan operator nomidan xabar qo'sha olardi.
--    O'qish policy'si ("telegram_orders.manage read support messages") qoladi.
--    telegram_support_threads: 0103 dan keyin faqat SELECT policy — yozish
--    allaqachon yopiq, o'zgartirish kerak emas.
-- ---------------------------------------------------------------------
drop policy if exists "telegram_orders.manage reply as operator" on telegram_support_messages;


-- ---------------------------------------------------------------------
-- 3) Xabar O'CHIRILGANDA ro'yxat maydonlari qayta hisoblanadi (1-band
--    to'ldiruvchisi). Mijoz/operator o'z xabarini o'chira oladi — aks holda
--    ro'yxatda eskirgan matn va noto'g'ri "javobsiz" belgisi qolardi.
--    Oxirgi xabar o'chsa last_message_at NULL -> suhbat ro'yxatdan chiqadi.
-- ---------------------------------------------------------------------
create or replace function public.support_thread_recalc_on_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_last_reply timestamptz;
begin
  select max(created_at) into v_last_reply
    from telegram_support_messages
   where customer_id = old.customer_id and sender = 'operator' and not coalesce(is_system, false);

  update telegram_support_threads t set
    last_message_at = (select max(created_at) from telegram_support_messages where customer_id = old.customer_id),
    last_message_preview = (select left(coalesce(message, ''), 200) from telegram_support_messages
                             where customer_id = old.customer_id and not coalesce(is_system, false)
                             order by created_at desc limit 1),
    last_message_kind = (select case when image_path is not null then 'image'
                                     when voice_path is not null then 'voice' else 'text' end
                           from telegram_support_messages
                          where customer_id = old.customer_id and not coalesce(is_system, false)
                          order by created_at desc limit 1),
    first_unanswered_at = (select min(created_at) from telegram_support_messages
                            where customer_id = old.customer_id and sender = 'customer'
                              and (v_last_reply is null or created_at > v_last_reply))
  where t.customer_id = old.customer_id;
  return old;
end;
$$;

drop trigger if exists trg_support_thread_recalc_on_delete on telegram_support_messages;
create trigger trg_support_thread_recalc_on_delete
  after delete on telegram_support_messages
  for each row execute function public.support_thread_recalc_on_delete();
