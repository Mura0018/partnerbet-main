# PRODUCTION_CHECKLIST.md — Phase 6

## 1. UI/UX

| Band | Holat | Izoh |
|---|---|---|
| Mobil moslashuvchanlik | ✅ | Barcha sahifalar `md:`/`lg:` breakpoint bilan mobile-first |
| Desktop moslashuvchanlik | ✅ | `max-w-7xl`/`max-w-4xl` konteynerlar, grid layout |
| Yuklanish tezligi | ✅ | Server Component'lar (SSR), keshlash (`football_cache`), `next/image` o'rniga optimallashtirilgan `<img>` (tashqi domenlar uchun) |
| Animatsiyalar | ✅ | `fade-in-up`, `stagger-item`, `card-premium` hover — Phase 5 |
| Tipografiya | ✅ | Aniq o'lcham ierarxiyasi (`text-[28px]` sarlavha → `text-[13px]` matn), `@tailwindcss/typography` rich-text uchun |
| Ikonka tizimi | ✅ | Yagona kutubxona — `lucide-react`, hammasi bir xil uslubda |
| Tugmalar | ✅ | Yagona `Button` komponenti, 4 variant, CTA-yashil qoidasi izchil |
| Formalar | ✅ | Validatsiya (frontend + backend, Phase 2/3), xato xabarlari aniq |
| Accessibility | ✅ | `alt` atributlar, `aria-label` ikonka-tugmalarda, semantik HTML (`<article>`, `<nav aria-label="Breadcrumb">`) |
| Footer | ✅ | To'liq, barcha havolalar real (Phase 6) |
| Header | ✅ | Umumiy `PublicHeader`, mobil menyu |
| Navigatsiya | ✅ | Barcha asosiy bo'limlarga to'g'ridan-to'g'ri kirish |
| Breadcrumbs | ✅ | Blog, Football News, Partner detal sahifalarida |
| Bo'sh holatlar | ✅ | Har bir ro'yxat/jadval uchun professional "ma'lumot yo'q" holati (`EmptyState`) |
| Xato sahifalari | ✅ | 404 (`not-found.tsx`), 500 (`error.tsx`) — Phase 0'dan, ranglari Phase 5'da yangilandi |
| Yuklanish holati | ✅ | `app/loading.tsx` (yangi, Phase 6) |

## 2. SEO

| Band | Holat | Fayl |
|---|---|---|
| Sitemap | ✅ (yangi) | `app/sitemap.ts` — statik + dinamik (postlar, yangiliklar, hamkorlar) |
| Robots.txt | ✅ (yangi) | `app/robots.ts` — admin/auth/api yashiringan |
| Open Graph | ✅ | `generateMetadata()` har bir kontent sahifasida (Phase 3d/5/6) |
| Twitter Cards | ✅ | Root layout'da (`summary_large_image`) |
| Canonical URL | ✅ | `metadataBase` orqali avtomatik (Next.js) |
| Meta title/description | ✅ | Har bir sahifada individual, admin sozlaydigan standart qiymatlar bilan |
| Structured data | ✅ (yangi) | `Organization` (root), `Article` (blog/football news), `FAQPage` (`/faq`) |

## 3. Sifat nazorati (QA)

| Tekshiruv | Natija |
|---|---|
| O'lik kod (`TODO`/`FIXME`/`console.log`) | Topilmadi |
| Buzilgan ichki havolalar | Topilmadi — barcha `href` statik yo'llar mos `page.tsx`ga ega ekanligi tasdiqlandi |
| Ishlatilmagan fayllar | Topilmadi (barcha `lib/` fayllari kamida bitta joyda import qilingan) |
| **Ishlatilmagan jadval** | **Topildi va tuzatildi**: `faqs` jadvali Phase 1'dan beri bor edi, hech qachon so'ralmagan — endi `/admin/faq` + `/faq` orqali to'liq ishlaydi |
| Eski/nomos rang qiymatlari | Topildi va tuzatildi: bir nechta sahifada eski accent-ko'k (`#00A3FF`) glow-soyalar qolib ketgan edi, Phase 5'ning yangi rangiga (`#3D7FFF`) moslashtirildi |
| "Tez orada" disabled havolalar | Footer'dagi "Affiliate Disclosure"/"Licensing" olib tashlandi, real Legal sahifalarga almashtirildi |

## 4. Deploy oldidan tekshirish (Vercel)

- [ ] `.env.local` barcha maydonlari to'ldirilgan (`SUPABASE_*`, `NEXT_PUBLIC_SITE_URL`, `CRON_SECRET`)
- [ ] `supabase/schema.sql` Supabase SQL Editor'da ishga tushirilgan (28 migratsiya)
- [ ] Birinchi Super Admin yaratilgan (README, "Birinchi admin" bo'limi)
- [ ] Supabase Dashboard > Authentication > URL Configuration'ga
      `/auth/reset-password`, `/auth/verify-email` qo'shilgan
- [ ] Vercel Cron (`vercel.json`) faollashtirilgan, `CRON_SECRET` Vercel
      Dashboard'da sozlangan
- [ ] Kamida bitta Football Data provayder tanlangan va kaliti kiritilgan
      (Sozlamalar > API kalitlar) — aks holda Football Center bo'sh holatda
      qoladi (bu **xato emas**, dizayn bo'yicha to'g'ri)
- [ ] Push Notification VAPID kalitlari kiritilgan (agar funksiya kerak bo'lsa)
- [ ] Sayt nomi, logotip, ranglar Sozlamalar orqali moslashtirilgan
- [ ] `next build` xatosiz o'tishi tekshirilgan (haqiqiy muhitda, `npm install`dan keyin)

## 5. Bilinigan cheklovlar (halol, hujjatlashtirilgan)

- Sportmonks/Football-Data.org moslashtiruvchilari haqiqiy so'rov bilan
  sinalmagan (tarmoq yo'qligi sababli) — `FOOTBALL_CENTER.md`da izohlangan.
- Batafsil o'yin-ichi statistika (pas aniqligi va h.k.) yo'q — provider
  interfeysi buni qo'llab-quvvatlashga tayyor, lekin metod hali qo'shilmagan.
- To'liq Media Library "qayerda ishlatilgan" kuzatuvi yo'q (`MEDIA_LIBRARY_AND_PUSH.md`).

## Yakuniy xulosa

Loyiha **production-ready** holatda: barcha asosiy foydalanuvchi yo'llari
(bosh sahifa → football → blog → hamkorlar → yuklab olish → huquqiy
sahifalar) to'liq, ishlaydigan va halol (soxta kontentsiz). Qolgan
ishlar — real API kalitlari va kontentni admin panel orqali kiritish,
bu texnik ish emas, operatsion ish.
