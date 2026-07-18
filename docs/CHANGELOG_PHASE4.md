# CHANGELOG — Phase 4 (Media Library + Push Notifications)

## Qo'shildi

### Ma'lumotlar bazasi (`0028_media_library_and_push.sql`)
- `push_subscriptions` — Web Push obunalari (login talab qilinmaydi,
  endpoint = token pattern).
- `push_notification_log` — yuborish tarixi/auditi.
- `media` jadvali o'zgarmadi (Phase 1 sxemasi galereya uchun yetarli edi).

### Media Library
- `/admin/media` — to'liq galereya: drag-and-drop ko'p fayl yuklash,
  qidiruv, URL nusxalash, o'chirish. Mavjud `lib/media/upload.ts`
  bilan bitta manbadan ishlaydi.

### Push Notifications (to'liq, uchtaan-oxirigacha)
- `public/sw.js` — service worker.
- `lib/push/subscribe.ts`, `NotificationBell.tsx` — client obuna oqimi.
- `lib/push/sendPush.ts` — server yuborish (`web-push`, VAPID).
- `app/api/push/vapid-public-key/`, `subscribe/`, `unsubscribe/` — public
  route'lar.
- `app/api/admin/push/send/` — admin yuborish (`settings.manage`).
- `/admin/push` — yozish/yuborish UI, obunachilar soni, yuborish tarixi.
- Bosh sahifada "Bell" tugmasi (header).

## O'zgartirildi

- `middleware.ts` — `/admin/media`, `/admin/push` route tekshiruvlari;
  texnik ishlar tekshiruvi endi `sw.js`ni chetlab o'tadi (aks holda
  texnik ishlar paytida service worker ishlamay qolardi).
- `app/admin/layout.tsx` — "Media Library", "Push Notifications" nav
  bandlari.
- `app/page.tsx` — `NotificationBell` qo'shildi.
- `package.json` — `web-push`, `@types/web-push` qo'shildi.

## Xavfsizlik

- VAPID **private** kalit hech qachon brauzerga chiqmaydi — faqat
  **public** kalit uchun maxsus, ataylab ochiq endpoint.
- Obuna ro'yxatini faqat `settings.manage` huquqiga ega admin ko'ra oladi;
  yozish (obuna bo'lish/bekor qilish) esa hammaga ochiq, lekin faqat
  o'z `endpoint`i orqali (taxmin qilib bo'lmaydigan token sifatida).
- O'lik obunalar (404/410) yuborishda avtomatik o'chiriladi.

## Tekshiruv

Barcha yangi/o'zgargan fayllar `tsc --strict` bilan tekshirildi.
**1 ta haqiqiy xato topildi va tuzatildi** (`lib/push/subscribe.ts` —
TypeScript 5.x `Uint8Array`/`BufferSource` tip nomuvofiqligi,
`MEDIA_LIBRARY_AND_PUSH.md`da batafsil). Qolgan xatolar — avvalgi
bosqichlardan tanish muhit-sabab soxta signal.

## Keyingi qadam

Asl yo'l xaritasidagi navbatdagi bosqich — **Phase 5: Frontend dizayn**
(Dark/Light Mode, qidiruv, sahifalash, related/trending postlar,
professional footer sahifalari) yoki boshqa ustuvorlikni bering.
