-- =====================================================================
--  KOP KASSA — 8-BOSQICH (OXIRGI): CHATLAR
--  (A) Jamoa chati professional: tizim xabarlarини turга ajratish
--      (event_type) + pinned qoidalar (site_settings).
--  (B) Support owner-routing kodда (support/route.ts) — bu migratsiyа
--      faqat jamoa chati qismi.
-- =====================================================================

-- Hodisa turi: null/'user' = oddiy suhbat; 'handoff' | 'debt' | 'alert' |
-- 'status' = tizim hodisalari (avvalgi bosqichlar yozadi). is_system BILAN
-- birga ishlaydi (is_system=true bo'lganlarga tur beriladi).
alter table team_chat_messages add column if not exists event_type text;

-- Pinned qoidalar (super_admin tahrirlaydi, hamma ko'radi).
insert into site_settings (key, value)
values ('team_chat_rules', '{"text": "1) Band bolsangiz darhol Bandman deb belgilang. 2) Qarzni 24 soat ichida tasdiqlang (Toladim/Oldim). 3) Mijozga tez va hurmat bilan javob bering. 4) Handoffga chiqqan buyurtmani darhol Olaman bilan oling."}'::jsonb)
on conflict (key) do nothing;
