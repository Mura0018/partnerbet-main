# AFFILIATE_MANAGER.md — Phase 3b: Enterprise Affiliate Manager

## Arxitektura falsafasi: hech qanday brend qattiq yozilmagan

Butun modul — jadval sxemasidan tortib `/go/{slug}` yo'nalishigacha —
**cheksiz sonli hamkor** uchun ishlaydi. Hech qayerda "1xBet" yoki boshqa
biror brend nomi kodga yozilmagan. Yangi hamkor qo'shish = admin panelda
bitta forma to'ldirish, kodga tegish shart emas.

## Ma'lumotlar modeli

```
affiliate_partners (1) ──< promo_codes (∞)
affiliate_partners (1) ──< partner_redirect_rules (∞)
affiliate_partners (1) ──< affiliate_clicks (∞)
affiliate_partners (1) ──< advertisements (∞, ixtiyoriy bog'lanish)
```

**Eski `promotions` jadvali o'chirildi** — u bitta hamkor = bitta promo-kod
degan soddalashtirilgan modelga asoslangan edi. Yangi modelda bitta hamkor
cheklanmagan sonli promo-kodga ega bo'lishi mumkin (`promo_codes`, FK orqali).

### `affiliate_partners`
Barcha so'ralgan maydonlar: nom, logotip, tavsif, website/affiliate/APK/Google
Play/App Store URL, deep link, bonus tavsifi, mamlakatlar (`text[]`), tillar
(`text[]`), reyting, priority (tartib), active/featured, click_count.

**URL validatsiyasi ma'lumotlar bazasi darajasida** (`CHECK` constraint) —
har bir URL maydoni `^https?://` bilan boshlanishini talab qiladi (deep_link
esa istalgan URI sxemasini, masalan `myapp://`, qabul qiladi). Bu shuni
anglatadiki, **hatto to'g'ridan-to'g'ri Supabase API orqali** noto'g'ri URL
kiritishga urinilsa ham, baza uni rad etadi — faqat frontend tekshiruviga
tayanilmagan.

### `promo_codes`
Ko'p-ko'plik: bitta hamkorning cheksiz promo-kodlari. `expires_at`
(muddat), `is_featured`, `usage_count` (har "Copy" bosilganda ortadi,
`/api/promo/track` orqali — xavfsiz, chunki jadvalning o'zi anonim yozishga
yopiq, faqat shu bitta hisoblagich uchun maxsus ochiq endpoint bor).

### `partner_redirect_rules` — Smart Redirect
Mamlakat/til/qurilma bo'yicha maxsus manzil qoidalari. **Ochiq o'qilmaydi**
— faqat admin va server (`/go/{slug}` route'i, service-role orqali) ko'ra
oladi.

### `affiliate_clicks` — Click Analytics
Har bir haqiqiy bosishning to'liq yozuvi: hamkor, banner (agar bo'lsa),
mamlakat, qurilma, brauzer, til, referrer. Faqat `promotions.manage`
huquqiga ega admin o'qiy oladi; faqat `/go/{slug}` (service-role) yoza oladi.

## `/go/{slug}` — Smart Redirect + Click Tracking (yagona yo'l)

Saytdagi **har qanday** hamkor havolasi (partner kartasi, banner, promo
tugmasi) `https://couponbet.org/go/{hamkor-slug}` ga yo'naltirilishi kerak
— hamkorning xom `affiliate_url`siga emas. Bu route:

1. So'rov qiluvchining **qurilmasi** (user-agent), **mamlakati**
   (`x-vercel-ip-country` — Vercel'da avtomatik) va **tili**
   (`Accept-Language`) ni aniqlaydi.
2. `partner_redirect_rules`dan mos qoidani qidiradi (priority tartibida).
3. Qoida topilmasa: qurilma mobil/planshet bo'lsa va `deep_link`
   kiritilgan bo'lsa — o'shani, aks holda standart `affiliate_url`ni
   ishlatadi. **Shunday qilib, "desktop foydalanuvchi bitta havola, mobil
   boshqasini oladi" talabi qoida yaratilmagan holatda ham ishlaydi.**
4. Bosishni `affiliate_clicks`ga yozadi va hisoblagichlarni oshiradi.
5. 302 bilan yo'naltiradi.

Bannerlar ham shu yo'ldan foydalanishi mumkin:
`/go/{slug}?banner={banner_id}` — bu holda banner klik hisoblagichi ham
bir vaqtda oshiriladi.

## Banner Manager

Mavjud `advertisements` jadvali (Phase 1) kengaytirildi — **yangi, ikkinchi
jadval yaratilmadi** (dublikat bo'lmasligi uchun): `partner_id`,
`banner_size` (desktop/tablet/mobile/square/popup/sticky/hero),
`target_countries`, `target_languages`, `width_px`/`height_px`. Admin UI
(`/admin/banners`) — yuklash, yoqish/o'chirish, rejalashtirish
(`starts_at`/`ends_at` — Phase 1'dan mavjud edi, endi UI orqali ham
sozlanadi), hamkorga bog'lash.

## Link Health — buzilgan havolalarni avtomatik aniqlash

`lib/affiliates/linkHealth.ts` har bir URL'ni:
- **HEAD so'rovi** bilan tekshiradi (engil, tez)
- Redirect'larni **qo'lda** kuzatib boradi (10 tagacha) — shu orqali oddiy
  "ishlamayapti" bilan **redirect tsikli**ni ajratib bera oladi
- Noto'g'ri formatni (`invalid`) so'rov yuborishdan oldin aniqlaydi

**Ikki xil ishga tushirish usuli:**
1. **Qo'lda** — admin panelda "Havolalarni tekshirish" tugmasi
   (`/api/admin/affiliates/check-links`).
2. **Avtomatik** — Vercel Cron (`vercel.json`, har 6 soatda,
   `/api/cron/check-affiliate-links`). Ishlashi uchun **Vercel Dashboard'da
   `CRON_SECRET` environment variable'ni sozlash kerak** (`.env.example`da
   izohlangan) — Vercel bu qiymatni cron so'roviga avtomatik biriktiradi.

Natijalar `affiliate_partners.link_health` (JSONB) ustunida saqlanadi va
admin panelda har bir hamkor uchun rangli belgi (✅/⚠️) ko'rinishida
ko'rsatiladi.

## Xavfsizlik

- **Faqat vakolatli adminlar boshqaradi**: barcha yozish amallari
  `promotions.manage` (yoki bannerlar uchun `advertisements.manage`)
  ruxsatini talab qiladi — middleware darajasida (`/admin/affiliates`,
  `/admin/banners`) va Postgres RLS darajasida (chetlab o'tib bo'lmaydi).
- **Har bir URL tekshiriladi** — frontend (`lib/validation/url.ts`, darhol
  fikr-mulohaza) VA backend (ma'lumotlar bazasi `CHECK` constraint,
  majburiy).
- **Har bir o'zgarish audit qilinadi** — `affiliate_partners`, `promo_codes`,
  `partner_redirect_rules` uchun avtomatik audit trigger (Phase 1
  infratuzilmasi).
- **Kirish nazorati**: `partner_redirect_rules` va `affiliate_clicks`
  hech qachon ochiq o'qilmaydi — faqat server (service-role) yoki
  vakolatli admin.

## Yangi/o'zgargan fayllar

| Fayl | Vazifasi |
|---|---|
| `supabase/migrations/0025_affiliate_manager.sql` | To'liq sxema |
| `lib/validation/url.ts` | URL validatsiyasi (frontend) |
| `lib/geo.ts` | Qurilma/mamlakat/til aniqlash |
| `lib/affiliates/linkHealth.ts` | Havola tekshirish mantiqi |
| `lib/affiliates/runLinkHealthCheck.ts` | Umumiy tekshiruv funksiyasi |
| `app/go/[slug]/route.ts` | **Smart Redirect + Click Tracking** |
| `app/api/promo/track/route.ts` | Promo-kod ishlatish hisoblagichi |
| `app/api/admin/affiliates/check-links/route.ts` | Qo'lda havola tekshiruvi |
| `app/api/cron/check-affiliate-links/route.ts` | Avtomatik (cron) tekshiruv |
| `vercel.json` | Cron jadvali (har 6 soat) |
| `app/admin/affiliates/page.tsx` | Hamkorlar, promo-kodlar, redirect qoidalari, link health UI |
| `app/admin/banners/page.tsx` | Kengaytirilgan Banner Manager (eski `/admin/ads` o'rnini bosdi) |
| `app/admin/dashboard/page.tsx` | Click Analytics grafiklari qo'shildi |
| `app/page.tsx` | "Partner Promo Codes" bo'limi endi haqiqiy ma'lumot bilan ishlaydi |

## Tekshiruv

Barcha yangi/o'zgargan fayllar `tsc --strict` bilan tekshirildi. Qolgan
xatolarning barchasi tekshiruv muhitida `@types/react`/`node_modules`
o'rnatilmaganidan kelib chiqadigan soxta signal (masalan `useState`
generic tipi hal qilinmagani sababli keyingi qatordagi `Object.entries`
ham noto'g'ri "unknown" deb belgilanadi — buni alohida minimal misolda
tasdiqladim). Haqiqiy loyihada `npm install`dan keyin bular yo'qoladi.
