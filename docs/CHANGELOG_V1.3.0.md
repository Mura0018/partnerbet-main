# CHANGELOG_V1.3.0.md — Real Production Integration & System Verification

> Bu bosqichda yangi funksiya qo'shilmadi, sayt qayta dizayn qilinmadi —
> faqat mavjud 10 modulning to'liq audit va integratsiya tekshiruvi,
> topilgan real muammolarni tuzatish.

## Ma'lumotlar bazasi

- `0032_v1_3_0_hardening.sql` — yangi `rate_limit_events` jadvali
  (umumiy, qayta ishlatiladigan rate-limit ledger).

## Xavfsizlik — Rate Limiting (asosiy topilma)

5 ta ochiq/admin endpoint himoyasiz ekanligi aniqlandi va tuzatildi:
- `app/api/content/track-view/route.ts` — 30/daqiqa/IP
- `app/api/promo/track/route.ts` — 20/daqiqa/IP
- `app/api/push/subscribe/route.ts` — 10/daqiqa/IP
- `app/api/push/unsubscribe/route.ts` — 10/daqiqa/IP
- `app/api/admin/push/send/route.ts` — 3/5 daqiqa/admin (broadcast spam'dan himoya)

Yangi: `lib/security/rateLimit.ts` — umumiy, qayta ishlatiladigan
yordamchi (mavjud login/streaming/donations rate-limiter'lari
o'zgartirilmadi, chunki ular allaqachon tasdiqlangan va ishlaydi).

## Middleware

- `middleware.ts` — `/admin/donations` yozuvi `ROUTE_PERMISSIONS`
  massivida ikki marta takrorlangan edi (dublikat kod, funksional xato
  emas) — olib tashlandi.

## Performance

- `app/admin/categories/page.tsx`, `app/admin/tags/page.tsx` — N+1
  so'rov muammosi (har bir qator uchun alohida COUNT so'rovi) bitta
  so'rov + client-side agregatsiyaga o'tkazildi.

## SEO

- `app/sitemap.ts` — `/support` va `/support/supporters` (v1.2.0'da
  qo'shilgan, lekin sitemap'ga kiritilmagan) qo'shildi.
- `app/support/layout.tsx` — yangi, `/support` segmentiga metadata
  qo'shish uchun (sahifaning o'zi client component bo'lgani uchun
  to'g'ridan-to'g'ri metadata eksport qila olmasdi).

## Integratsiya tekshiruvi — muammo topilmadi (tasdiqlandi)

- Football Center ↔ Live Streaming: `football_provider` qiymatlari
  3 ta mustaqil joyda (registry, admin dropdown, fixtures API) bir xil.
- Affiliate redirect ↔ Dashboard: `affiliate_clicks` yozuvchi/o'quvchi
  bir xil sxema.
- Donations webhook ↔ Dashboard/Export/Top-Supporters: `status`
  qiymatlari barcha joyda mos.
- Audit logging: 39 jadvaldan 15 tasi audit qilinadi, qolgani ataylab
  (sabab hujjatlashtirilgan).

## Tekshiruv

Barcha fayllar `tsc --strict` bilan qayta tekshirildi — yangi xato yo'q.
RBAC (18 ruxsat, 8 rol), RLS qamrovi (39/39 jadval), permission
kalitlari mosligi — barchasi skript orqali qayta tasdiqlandi.

## Keyingi qadam

Talab bo'yicha shu yerda to'xtaymiz — yakuniy ko'rib chiqishni
kutamiz.
