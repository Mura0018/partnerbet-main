# CHANGELOG — Phase 3b (Enterprise Affiliate Manager)

## Qo'shildi

### Ma'lumotlar bazasi (`0025_affiliate_manager.sql`)
- `affiliate_partners` — cheksiz hamkor, to'liq maydon to'plami, DB
  darajasida URL validatsiyasi.
- `promo_codes` — bitta hamkorga ko'p promo-kod (1:∞).
- `partner_redirect_rules` — mamlakat/til/qurilma bo'yicha Smart Redirect.
- `affiliate_clicks` — to'liq click analytics (BRIN indeks, millionlab
  qatorga tayyor).
- `advertisements` kengaytirildi: `partner_id`, `banner_size`,
  `target_countries`, `target_languages`, `width_px`/`height_px` + orqaga
  qarab URL validatsiyasi qo'shildi (Phase 1'da yo'q edi).
- **Eski `promotions` jadvali o'chirildi** (yangi model bilan almashtirildi
  — ikkita bir-biriga o'xshash tizim qoldirilmadi).

### Backend
- `app/go/[slug]/route.ts` — Smart Redirect + Click Tracking, yagona yo'l.
- `app/api/promo/track/route.ts` — promo-kod ishlatish hisoblagichi.
- `app/api/admin/affiliates/check-links/route.ts` — qo'lda link health.
- `app/api/cron/check-affiliate-links/route.ts` + `vercel.json` — avtomatik
  link health (har 6 soat).
- `lib/geo.ts`, `lib/validation/url.ts`, `lib/affiliates/*` — yordamchi
  modullar.

### Frontend
- `/admin/affiliates` — to'liq Hamkorlar boshqaruvi (Ma'lumotlar / Promo-kodlar
  / Smart Redirect / Link Health — 4 ichki bo'lim).
- `/admin/banners` — kengaytirilgan Banner Manager (o'lcham, hamkor,
  mamlakat/til maqsadlash, rejalashtirish).
- `/admin/dashboard` — Affiliate Click Analytics (jami/kunlik/haftalik/oylik,
  14 kunlik grafik, mamlakat/qurilma taqsimoti — `recharts`).
- `app/page.tsx` — "Partner Promo Codes" bo'limi endi bazadagi haqiqiy
  hamkorlar va promo-kodlarni ko'rsatadi (nusxalash tugmasi ishlaydi,
  ishlatish hisoblanadi).

## O'zgartirildi / o'chirildi

- **`/admin/ads` → `/admin/banners`** (route ko'chirildi, funksiyasi
  kengaytirildi).
- `middleware.ts` — `/admin/affiliates` (`promotions.manage`) va
  `/admin/banners` route tekshiruvlari qo'shildi; maintenance-check
  matcher'iga `/go` istisno qilindi (texnik ishlar paytida ham affiliate
  tracking ishlashi kerak).
- `app/admin/layout.tsx` — "Affiliates" va "Banners" nav bandlari.
- `.env.example` — `CRON_SECRET` qo'shildi, `API_FOOTBALL_KEY` izohi
  yangilandi (endi ixtiyoriy fallback).

## Xavfsizlik

- Har bir URL maydoni **ma'lumotlar bazasi darajasida** (`CHECK`
  constraint) validatsiya qilinadi — frontend chetlab o'tilsa ham
  buzilmaydi.
- `partner_redirect_rules` va `affiliate_clicks` — ochiq o'qilmaydi, faqat
  admin (`promotions.manage`) yoki server (service-role).
- Har bir yozish — audit qilinadi (mavjud `audit_trigger()` infratuzilmasi,
  Phase 1).

## Tekshiruv

Barcha yangi/o'zgargan fayllar `tsc --strict` bilan tekshirildi. Qolgan
xatolar — tekshiruv muhitida `node_modules` o'rnatilmagani sababli
yuzaga keladigan kaskad soxta signal (izolyatsiya qilingan test bilan
tasdiqlandi, `AFFILIATE_MANAGER.md`da tushuntirilgan).

## Keyingi qadam

**Phase 3c — Football Center**: Live Matches, Fixtures, Results, League
Tables, Team Pages, Match Statistics, Top Scorers, News, Videos, Featured
Matches — kelajakdagi Football API integratsiyasiga tayyor arxitektura
bilan.
