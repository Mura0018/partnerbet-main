# SECURITY REPORT — Phase 1

**Metodologiya:** har bir jadval uchun "kim, nimani, qachon ko'ra/yoza oladi" savoli
qo'lda modellashtirildi (threat modeling), so'ng haqiqiy RLS siyosati matni bilan
solishtirildi. 3 ta darajaga bo'lindi: 🔴 Critical/High, 🟡 Medium, ✅ To'g'ri.

---

## 🔴 Topilgan va tuzatilgan zaifliklar

### S1 — Soxta admin javobi yuborish mumkin edi (yuqori xavf)
**Jadval:** `support_messages`
**Vektor:** Har qanday tashqi tomon (login shart emas) `insert` so'rovi bilan
`{conversation_id: <istalgan mavjud ID>, sender: "admin", message: "..."}` yubora
olardi — RLS `with check (true)` hech narsani tekshirmasdi. Bu ijtimoiy muhandislik
(soxta "admin"dan xabar) uchun ishlatilishi mumkin edi.
**Tuzatildi:** `with check (sender = 'visitor')` — endi tashqi tomon faqat o'zini
"visitor" deb belgilay oladi; haqiqiy admin javoblari alohida `support.manage`
siyosati orqali (login qilingan admin hisobidan) yoziladi.

### S2 — Ichki ruxsat tuzilmasi ortiqcha ochiq edi
**Jadvallar:** `roles`, `permissions`, `role_permissions`
**Vektor:** Har qanday login qilgan hisob (shu jumladan Phase 2'da qo'shiladigan oddiy
"user" hisoblari) butun rol/ruxsat matritsasini o'qiy olardi — bu maxfiy emas, lekin
"eng kam imtiyoz" (least privilege) tamoyiliga zid, va tizim strukturasi haqida
keraksiz ma'lumot beradi (masalan, qaysi ruxsatlar mavjudligini, "roles.manage" kabi
nozik kalitlar borligini).
**Tuzatildi:** `is_admin_user()`ga cheklandi — faqat haqiqiy admin/editor hisoblari.

### S3 — Qoralama postlarning teglari oshkor bo'lardi
**Jadval:** `post_tags`
**Vektor:** `posts` jadvali qoralamalarni to'g'ri yashiradi, lekin `post_tags` alohida
so'rov qilinganda cheklovsiz edi — tashqi tomon nashr etilmagan post UUID va unga
bog'langan teglarni bila olardi (past xavf, chunki UUID taxmin qilib bo'lmaydi, lekin
tamoyil buzilgan).
**Tuzatildi:** faqat tegishli post `status='published'` bo'lsa ko'rinadi.

### S4 — Support suhbatini boshqa holatda "qalbakilashtirish"
**Jadval:** `support_conversations`
**Vektor:** Anonim tomon yangi suhbat yaratganda `status='resolved'` yoki
`assigned_admin_id`ni o'zi belgilab qo'yishi mumkin edi.
**Tuzatildi:** faqat `status='open', assigned_admin_id=null` bilan yaratish mumkin.

### S5 — Nozik jadvallarda audit tarixi yo'q edi
**Jadvallar:** `profiles`, `roles`, `permissions`, `role_permissions`
**Vektor:** to'g'ridan-to'g'ri "buzish" emas, lekin **kuzatuvchanlik teshigi**: agar
kimdir (masalan, service-role kalitidan noto'g'ri foydalanilib) o'z rolini
super_admin'ga o'zgartirsa yoki ruxsat matritsasini o'zgartirsa — buning izi
qolmasdi.
**Tuzatildi:** barcha to'rttasiga audit trigger qo'shildi (`role_permissions` uchun
maxsus composite-key versiyasi).

---

## ✅ Tekshirilgan va TO'G'RI ekanligi tasdiqlangan joylar

- **`has_permission()`/`is_admin_user()` RLS rekursiyasi** — funksiyalar faqat
  chaqiruvchining o'z profiliga cheklangan so'rov beradi, bu har doim "self read
  profile" siyosati orqali ko'rinadi → cheksiz tsikl yuzaga kelmaydi (isbot:
  DATABASE_TEST_REPORT.md, 6-band).
- **O'z-o'zini yuqoriga ko'tarish (self-elevation)** — `prevent_self_role_escalation()`
  trigger orqali bloklangan, RLS CHECK'ga emas, ishonchli trigger'ga tayangan
  (RLS CHECK'dagi NEW/OLD solishtirish nozik va ishonchsiz bo'lishi mumkinligi
  sababli ataylab shu yondashuv tanlandi).
- **`audit_logs` yozib bo'lmaydi** — hech bir rol (super_admin ham) uchun
  insert/update/delete siyosati yo'q; faqat `SECURITY DEFINER` trigger orqali
  yoziladi. Demak, hech kim o'z izini o'chira olmaydi.
- **Service role kaliti** — faqat `lib/supabaseAdmin.ts`da, faqat serverda
  ishlatiladi (Phase 0'da `lib/env.ts` orqali validatsiya qilingan), brauzerga hech
  qachon yuborilmaydi.
- **Maxfiy API kalitlar (`API_FOOTBALL_KEY`) ma'lumotlar bazasida saqlanmaydi** —
  faqat `.env.local`/Vercel environment variables'da, `site_settings`da emas.
- **`media`/`site_settings` publik o'qish** — qasddan (rasm URL'lari va sayt matni
  login'siz yuklanishi kerak), maxfiy ma'lumot yo'q.
- **`analytics_events` cheklovsiz insert** — qasddan (anonim tashrif buyuruvchi
  tracking'i), spam/flood himoyasi Phase 10 (Rate Limiting)ga rejalashtirilgan —
  qabul qilingan xavf, hozircha to'xtatilmadi.
- **Storage bucket'lar** — public read, lekin yozish faqat tegishli
  `*.manage` ruxsatiga ega hisoblarga.

## 🟡 Qabul qilingan xavflar (keyingi bosqichlarga rejalashtirilgan)

| Xavf | Nega hozir emas |
|---|---|
| `analytics_events`ga cheksiz spam insert | Rate Limiting — Phase 10 rejasida |
| Media fayl yuklashda virus/zararli fayl tekshiruvi yo'q | Media Library UI — Phase 4, fayl skanerlash — Phase 10 |
| `navigation_items.parent_id` — ota o'chirilsa, bolalar ham `cascade` bilan o'chadi | Dizayn qarori (CMS uchun odatiy xulq), ma'lumot yo'qotish xavfi past (faqat label+url) |

---

## Xulosa

5 ta zaiflik topildi (1 tasi yuqori xavf — S1, qolgani past/o'rta), barchasi
`0020_phase1_hardening.sql`da tuzatildi. Qolgan 3 ta "qabul qilingan xavf" ataylab
keyingi bosqichlarga qoldirilgan va sababi hujjatlashtirilgan. Boshqa yashirin
critical zaiflik topilmadi.
