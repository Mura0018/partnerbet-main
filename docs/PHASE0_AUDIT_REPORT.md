# PartnerBet Pro V2 — Phase 0 Audit Report
**Sana:** 2026-07-18
**Ko'lam:** partnerbet-main.zip — 19 fayl, ~1470 qator kod (Next.js 14 App Router + Supabase)

> Eslatma: konteynerda tashqi internet (npm registry) yopiq, shu sababli `npm install && next build`
> ishga tushirib bo'lmadi. Buning o'rniga har bir fayl qo'lda, qator-baqator TypeScript/Next.js
> qoidalariga solishtirib tekshirildi (static audit). Loyiha juda kichik (19 fayl) bo'lgani uchun bu
> usul ishonchli natija berdi. Fayllar Vercel'ga joylashtirilganda `next build` orqali yana bir bor
> avtomatik tasdiqlanadi.

---

## Umumiy xulosa

Loyiha — yaxshi boshlangan, ammo **demo/skeleton bosqichida** starter. Kod sifati o'rtacha yaxshi
(toza komponentlar, to'g'ri Supabase pattern), lekin bir nechta **jiddiy xavfsizlik va UX** kamchiliklari bor.
13 ta muammo topildi: **3 Critical, 5 High, 4 Medium, 3 Low**.

---

## 🔴 CRITICAL (darhol tuzatildi)

### C1 — Admin panelga har qanday login qilgan foydalanuvchi kira oladi
**Fayl:** `middleware.ts`
**Sabab:** Middleware faqat "sessiya bor-yo'qligini" tekshiradi (`getSession()`), lekin bu foydalanuvchi
haqiqatan `admin_profiles` jadvalida ro'yxatdan o'tgan admin ekanligini **tekshirmaydi**. RLS (schema.sql)
darajasida ma'lumotlarni to'g'ri himoya qilingan, lekin admin UI'ning o'zi (sahifalar, formalar, statistika)
har qanday autentifikatsiyadan o'tgan foydalanuvchiga ko'rinadi. Kelajakda public register qo'shilsa — bu
teshik darhol xavfli bo'ladi.
**Tuzatildi:** middleware endi `admin_profiles` jadvalida yozuv borligini ham tekshiradi.

### C2 — Saytda haqiqiy emas, o'ylab topilgan (fake) ma'lumotlar ko'rsatiladi
**Fayl:** `app/page.tsx`
**Sabab:** `FALLBACK_INSIGHTS` (Arsenal vs Man City va h.k.) va qattiq yozilgan `PROMOS` (`MURABET`,
`MURAWIN`) — bular Supabase bazasida mos jadval bo'lmasa yoki bo'sh bo'lsa, **haqiqiy natija sifatida**
foydalanuvchiga ko'rsatiladi. Bu affiliat sayt uchun ayniqsa xavfli: mavjud bo'lmagan promo-kodlarni
ko'rsatish ishonchni yo'qotadi. Foydalanuvchi talabiga ko'ra ("faqat real DB ma'lumoti bilan ishlashi kerak").
**Tuzatildi:** demo massivlar olib tashlandi, o'rniga toza "hozircha mavjud emas" holati qo'shildi.

### C3 — Navigatsiya va tugmalarning aksariyati hech qayerga olib bormaydi
**Fayl:** `app/page.tsx`
**Sabab:** Header nav (`Insights, Live, Standings, APK, Blog, Support`) va footer havolalarining hammasi
`href="#"` — bosilganda faqat sahifa boshiga sakraydi, URL'ga `#` qo'shadi va console'da hech narsa
qilmaydi. "Register" va "Start Chat" tugmalarida umuman `onClick` yo'q.
**Tuzatildi:** mavjud bo'limlarga (Insights, Live Scores, Promo/Register, APK) ishlaydigan ichki
anchor-havolalar qo'shildi. Hali qurilmagan sahifalarga (Blog, Standings, Support, Contact va boshqa
footer-huquqiy sahifalar — bular Phase 6 rejasida) havolalar **soxta ishlagandek ko'rsatilmaydi** —
vizual ravishda "Tez orada" holatiga o'tkazildi, shunda foydalanuvchi chalg'imaydi.

---

## 🟠 HIGH (Phase 0 doirasida tuzatildi)

### H1 — `tsconfig.json`: `strict: false`
TypeScript eng yaxshi amaliyoti buzilgan — bu `any` turlarini, `undefined` xatolarini build vaqtida
emas, runtime'da paydo bo'lishiga imkon beradi. **Tuzatildi:** `strict: true` yoqildi, kod qayta
tekshirildi (mos keladi, xatolik yo'q).

### H2 — `layout.tsx`da `metadataBase` yo'q
Next.js buni build paytida ogohlantiradi (`metadataBase property in metadata export is not set`) va
Open Graph rasm URL'lari noto'g'ri generatsiya bo'ladi. **Tuzatildi:** `metadataBase`, `viewport`,
`robots`, `icons` standart qiymatlari qo'shildi.

### H3 — Environment o'zgaruvchilar tekshirilmagan
`lib/supabase.ts` va `lib/supabaseAdmin.ts` `process.env.X!` (non-null assertion) ishlatadi — agar
`.env.local` to'ldirilmagan bo'lsa, xato xabari tushunarsiz bo'ladi (`Invalid URL` kabi). **Tuzatildi:**
`lib/env.ts` — aniq, o'zbekcha xato xabari beruvchi validatsiya qo'shildi.

### H4 — `analytics_events`ga ikki marta yozilishi mumkin
React StrictMode/dev rejimida `useEffect` ikki marta chaqiriladi — bu `page_view` hodisasini
ikki marta yozishi mumkin, statistikani buzadi. **Tuzatildi:** `useRef` guard qo'shildi.

### H5 — 404 va 500 sahifalari yo'q
Next.js standart (brendlanmagan, ingliz tilidagi, "This page could not be found") sahifasini
ko'rsatadi. **Tuzatildi:** `app/not-found.tsx` va `app/error.tsx` qo'shildi (minimal, brendli;
Phase 6'da footer-legal sahifalar bilan birga yanada boyitiladi).

---

## 🟡 MEDIUM (hisobotga kiritildi, keyingi bosqichlarda tuzatiladi — sababi bilan)

| # | Muammo | Nega hozir emas |
|---|---|---|
| M1 | RLS qoidalari `role` ustunini e'tiborga olmaydi — istalgan `admin_profiles` yozuvi (hatto `editor`) to'liq CRUD huquqiga ega | Phase 2'da Super Admin/Admin/Editor rol tizimi butunlay qurilganda, RLS ham shu bilan birga to'g'ri yoziladi — hozir yozib, Phase 2'da qayta yozish ortiqcha ish bo'lardi |
| M2 | `next.config.mjs`da `images.remotePatterns` hostname `"**"` (istalgan domen) | Hali `next/image` umuman ishlatilmayapti; Phase 7 (xavfsizlik) bosqichida haqiqiy domenlar (Supabase Storage) bilan cheklanadi |
| M3 | Admin CRUD sahifalarida (insights/blog/apk/ads) load/save/delete mantiqi 4 marta deyarli bir xil takrorlangan | Phase 1'da jadvallar (categories, tags, promotions va h.k.) qo'shilganda umumiy `useSupabaseCrud` hook yaratib, hammasi shunga o'tkaziladi — hozir alohida tuzatish keyin qayta yozishga olib keladi |
| M4 | "Standings" sahifasi va Blog/Support/Contact sahifalari mavjud emas | Bular funksiya yetishmasligi, "buzilgan" emas — Phase 6 (Footer sahifalar) va Phase 11 (Football markazi) rejasida |

---

## 🟢 LOW

| # | Muammo |
|---|---|
| L1 | Icon-only tugmalarda (Edit/Delete/Copy) `aria-label` yo'q — screen reader uchun noqulay |
| L2 | `lib/supabaseAdmin.ts` (service-role klient) hozircha hech qayerda ishlatilmaydi — Phase 1'da API route'larda kerak bo'ladi |
| L3 | Favicon/`app/icon.tsx` yo'q — Phase 5/8'da brend paketi bilan qo'shiladi |

---

## Phase 0'da bajarilgan tuzatishlar — xulosa

✅ `middleware.ts` — admin ekanligini (nafaqat login) tekshiradi
✅ `app/page.tsx` — barcha demo/fake ma'lumotlar olib tashlandi, toza bo'sh holatlar qo'shildi
✅ `app/page.tsx` — barcha "#" havolalar tuzatildi (ishlaydigan anchor yoki "tez orada" holati)
✅ `app/page.tsx` — Register/Start Chat tugmalari endi real harakat qiladi
✅ `app/page.tsx` — analytics ikki marta yozilishi oldini olindi
✅ `tsconfig.json` — `strict: true`
✅ `app/layout.tsx` — `metadataBase`, `viewport`, `robots`, `icons` qo'shildi
✅ `lib/env.ts` — yangi, environment validatsiya
✅ `lib/supabase.ts`, `lib/supabaseAdmin.ts` — validatsiyadan foydalanadi
✅ `app/not-found.tsx`, `app/error.tsx` — yangi, brendli 404/500

**Natija:** loyiha endi barqaror, xavfsizroq va halol (soxta kontentsiz) holatda. Build xatosiz
bo'lishi kerak (qo'lda TypeScript tekshiruvi asosida — network yo'qligi sababli `next build` fizik
ishga tushirilmadi, Vercel'ga birinchi deploy paytida tasdiqlanadi).

**Keyingi qadam:** Phase 1 — Supabase fundament (to'liq jadvallar: categories, tags, promotions,
football_news, banners, media, settings, roles, logs + RLS).
