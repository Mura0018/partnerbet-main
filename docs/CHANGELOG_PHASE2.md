# CHANGELOG — Phase 2 (Production Authentication System)

## Qo'shildi

### Ma'lumotlar bazasi
- 3 yangi migratsiya (`0021`–`0023`): 4 yangi rol (jami **8 rol**),
  `login_attempts` (brute-force), `profiles.locale`.

### Backend (API route'lar)
- `POST /api/auth/login` — rate-limited kirish (email: 5/15daq, IP: 20/15daq).
- `POST /api/auth/change-password` — joriy parolni qayta tekshirish bilan.
- `lib/supabaseServer.ts` — Route Handler uchun cookie-bog'langan Supabase client
  (`persistSession` — "Remember me"ni haqiqiy boshqaradi).
- `lib/auth/rateLimit.ts`, `lib/auth/password.ts` — qayta ishlatiladigan
  himoya modullari.

### Frontend sahifalari
- `/auth/login`, `/auth/forgot-password`, `/auth/reset-password`,
  `/auth/verify-email` — barchasi to'liq, 3 tilli, placeholder/TODO'siz.
- `/admin/profile` — parolni o'zgartirish, barcha qurilmalardan chiqish.
- `/admin/users` — rol boshqaruvi UI'i (`users.manage` bilan himoyalangan).

### RBAC
- `lib/auth/permissions.tsx` — `useCurrentProfile()`, `usePermission()`,
  `<Can>` komponenti (frontend UX qatlami).
- `middleware.ts` — qayta yozildi: endi `/admin/blog`, `/admin/insights`,
  `/admin/apk`, `/admin/ads`, `/admin/users` uchun **aniq ruxsat**ni
  tekshiradi (avval faqat "har qanday admin" tekshirilardi).

### Uch tillilik
- `lib/i18n/dictionaries.ts` — to'liq uz/ru/en lug'at (auth oqimlari + rollar
  + umumiy elementlar).
- `lib/i18n/LocaleProvider.tsx`, `LocaleSwitcher.tsx` — cookie-asoslangan til
  tanlovi, butun ilova bo'ylab.

## O'chirildi / birlashtirildi

- **`/admin/login` olib tashlandi** — endi bitta markazlashgan `/auth/login`
  ishlatiladi (dublikat autentifikatsiya logikasi yo'q).

## O'zgartirildi

- `app/layout.tsx` — `LocaleProvider` bilan o'raldi.
- `app/admin/layout.tsx` — yangi navigatsiya (Profil, Foydalanuvchilar),
  rol nishoni, til almashtirgich, ruxsatga qarab yashiriladigan menyu
  bandlari (`<Can>`).
- `app/page.tsx` — header/hero CTA tugmalari yangilandi (pastdagi Tuzatish
  bo'limiga qarang).
- `middleware.ts` — `/admin/login`ga emas, `/auth/login`ga yo'naltiradi;
  route-darajasidagi ruxsat tekshiruvi qo'shildi.

## Tuzatish (mijoz sharhidan keyin)

Boshlang'ich Phase 2 yetkazilmasida xato qilingan: PartnerBet — bahis
qabul qiluvchi platforma emas, mustaqil affiliate/analytics sayt, shuning
uchun ochiq foydalanuvchi ro'yxatdan o'tishi **kerak emas edi**. Tuzatildi:

- ❌ **`/auth/register` va `/api/auth/register` butunlay olib tashlandi.**
  Yangi admin/xodim hisoblari endi faqat mavjud administrator tomonidan
  Supabase Dashboard orqali yaratiladi (README'da tavsiflangan oqim).
- `/auth/login`dagi "Ro'yxatdan o'tish" havolasi va unga tegishli lug'at
  kalitlari (`login.noAccount`, `login.registerLink`, butun `register.*`
  bo'limi) olib tashlandi.
- `app/page.tsx` bosh sahifasidagi CTA tugmalari almashtirildi:
  - Header: "Register" → **"Open Partner"** (promo bo'limiga scroll)
  - Hero asosiy tugma: "Register Now" → **"Claim Bonus"** (promo bo'limiga scroll)
  - Hero ikkinchi tugma: "Download APK" → **"Download App"** (matn aniqlashtirildi)
  - Header'dagi ochiq "Kirish" havolasi olib tashlandi — admin login ommaviy
    marketing navigatsiyasida reklama qilinmasligi kerak.
- Barcha hujjatlar (`AUTHENTICATION.md`, ushbu fayl) mos ravishda yangilandi.
- **Hujjatlar endi ZIP ichida** — `partnerbet-main/docs/` papkasida barcha
  bosqichlarning hisobotlari (Phase 0–2) joylashgan; ilgari alohida chat
  fayllari sifatida yuborilgan va ZIP'ga qo'shilmagan edi.

## Tekshiruv

- Barcha yangi/o'zgargan `.ts`/`.tsx` fayllar `tsc --strict` bilan qayta
  tekshirildi. Bitta kutilgan soxta xato (`key` prop `<Can>` komponentida —
  faqat `@types/react` o'rnatilmagan tekshiruv muhitida yuzaga keladi,
  haqiqiy loyihada React'ning standart `key` mexanizmi orqali avtomatik
  hal bo'ladi — Phase 0'dagi "children missing" holati bilan bir xil sabab).
- Rol-ruxsat matritsasi (8 rol) Python orqali simulyatsiya qilinib
  tasdiqlandi.

## Muhim: Supabase loyiha sozlamalari (qo'lda bajarish kerak)

Bu bosqich kod darajasida to'liq, lekin ishlashi uchun Supabase
Dashboard'da bir martalik sozlash kerak:

1. **Authentication > Providers > Email** — "Confirm email" yoqilganligiga
   ishonch hosil qiling.
2. **Authentication > URL Configuration** — `Site URL` va `Redirect URLs`ga
   quyidagilarni qo'shing:
   - `https://SIZNING_DOMEN/auth/reset-password`
   - `https://SIZNING_DOMEN/auth/verify-email`

Batafsil: `AUTHENTICATION.md`.

## Keyingi qadam

**Phase 3 — Admin CMS = To'liq Website Builder**, endi to'liq autentifikatsiya
va 8-rolli RBAC fundamenti ustiga quriladi.
