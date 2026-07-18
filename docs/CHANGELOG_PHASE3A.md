# CHANGELOG — Phase 3a (Site Settings Panel)

> Phase 3 to'liq ko'lami (Site Settings + Affiliate Manager + Football
> Center + News CMS) 3a/3b/3c/3d'ga bo'lindi. Bu — **3a**.

## Qo'shildi

### Ma'lumotlar bazasi
- `0024_site_settings_phase3.sql`: `footer`/`maintenance`/`branding`
  sozlama kalitlari, `theme` kengaytirildi, yangi **`api_credentials`**
  jadvali (nol RLS siyosati — faqat service-role, hech qachon brauzerga
  ochilmaydi).

### Backend
- `app/api/admin/secrets/route.ts` — maxfiy kalitlarni yozish/holatini
  tekshirish (qiymat hech qachon qaytarilmaydi).
- `lib/auth/apiCredentials.ts` — server-only yordamchi.
- `app/api/football/fixtures/route.ts`, `standings/route.ts` — endi avval
  bazadan (admin kiritgan), keyin `.env`dan (fallback) kalitni oladi.

### Frontend
- `/admin/settings` — 7 bo'limli to'liq Sozlamalar UI (Umumiy, Brend,
  Ijtimoiy tarmoq, SEO, Analitika, API kalitlar, Texnik ishlar).
- `/maintenance` — texnik ishlar sahifasi.
- `lib/media/upload.ts` — logotip/favicon uchun haqiqiy fayl yuklash.

### Dinamik mavzu va metadata
- `tailwind.config.ts` + `app/globals.css` — ranglar endi CSS
  o'zgaruvchilar orqali; admin O'zgartirgan rang **darhol**, qayta
  deploy'siz butun saytga qo'llaniladi.
- `app/layout.tsx` — `generateMetadata()` endi bazadan sayt nomi/SEO
  standart qiymatlarini o'qiydi.
- `app/icon.tsx` — admin yuklagan favicon mavjud bo'lsa, o'shani ishlatadi.
- `app/page.tsx` — sayt nomi, logotip, footer tavsifi, aloqa emaili,
  ijtimoiy tarmoq havolalari — barchasi endi bazadan (moslashtirilmagan
  bo'lsa, statik standart qiymatga qaytadi).

## O'zgartirildi

- `middleware.ts` — endi ikki vazifa: `/admin/*` himoyasi (Phase 2) +
  butun sayt bo'yicha texnik ishlar rejimi tekshiruvi (admin bypass bilan).
- `app/admin/layout.tsx` — "Sozlamalar" nav bandi qo'shildi
  (`settings.manage` bilan himoyalangan).

## Xavfsizlik qarori (muhim)

So'ralgan "API Keys (Football APIs) — Admin paneldan boshqarish"ni **ochiq
`site_settings` jadvaliga emas**, alohida, hech kimga ochilmaydigan
`api_credentials` jadvaliga joylashtirdim — aks holda har qanday anonim
tashrifchi API kalitini to'g'ridan-to'g'ri o'qib olishi mumkin bo'lardi.
Batafsil: `SITE_SETTINGS.md`, "Muhim arxitektura qarorlari" bo'limi.

## Tekshiruv

Barcha yangi/o'zgargan fayllar `tsc --strict` bilan tekshirildi — faqat
oldindan ma'lum, muhit sababli soxta xato (`key` prop) qoldi.

## Keyingi qadam

**Phase 3b — Affiliate Manager**: cheksiz hamkorlar (nom, logotip, mamlakat,
sayt/APK/Store havolalari, promo-kod, reyting, tartib, klik hisoblagichi)
+ Banner Manager (yuklash/crop/almashtirish/rejalashtirish).
