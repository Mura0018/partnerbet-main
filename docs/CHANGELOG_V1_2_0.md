# CHANGELOG_V1_2_0.md — Donation & Support System

## Qo'shildi

### Ma'lumotlar bazasi (`0031_donation_system.sql`)
- Yangi ruxsat: `donations.manage` (faqat super_admin/admin — moliyaviy
  ma'lumotlar uchun ataylab tor doira, football/streaming
  ruxsatlaridan farqli).
- `payment_methods` — bitta jadval, `method_type` orqali gateway (Stripe/
  PayPal/generic) va crypto (USDT/BTC/ETH/SOL) ni farqlaydi.
- `donations` — hech qanday public RLS siyosati yo'q (to'liq
  server-mediated), amount/currency DB darajasida validatsiya.
- `donation_webhook_log` — har bir webhook urinishi (tasdiqlangan yoki
  yo'q) audit qilinadi.

### Xavfsizlik
- `lib/security/encryptedCredentials.ts` — **yangi umumiy modul**:
  Live Streaming (v1.1.0) va Donations ikkalasi ham o'zining alohida,
  deyarli bir xil shifrlash-saqlash kodini yozgani aniqlanib, bitta
  namespace-asoslangan modulga birlashtirildi (dublikat kod olib
  tashlandi). `lib/streaming/credentials.ts` va
  `lib/donations/credentials.ts` endi shunga yupqa wrapper.

### Provider Abstraction Layer
- `lib/donations/types.ts` — `PaymentGatewayProvider` interfeysi.
- `lib/donations/providers/stripeProvider.ts` — **haqiqiy** Stripe
  Checkout Sessions API + webhook HMAC tekshiruvi.
- `lib/donations/providers/paypalProvider.ts` — **haqiqiy** PayPal
  Orders v2 API + PayPal webhook tekshiruv API'si orqali verifikatsiya.
- `lib/donations/providers/genericProvider.ts` — umumiy, hujjatlashtirilgan
  REST+HMAC shartnoma (haqiqiy bo'lmagan provайder nomi o'ylab
  topilmagan — Live Streaming bilan bir xil falsafa).
- `lib/donations/registry.ts` — provайder yaratish (stripe/paypal/generic).

### Backend
- `app/api/donations/checkout/route.ts` — checkout session yaratish,
  server-side validatsiya + rate limiting (10/15daq).
- `app/api/donations/webhook/[methodKey]/route.ts` — imzo tekshiruvi +
  audit, faqat tasdiqlangan hodisalar donation holatini o'zgartiradi.
- `app/api/donations/crypto-report/route.ts` — kripto "yubordim" hisoboti.
- `app/api/donations/top-supporters/route.ts` — ochiq, faqat xavfsiz
  maydonlar.
- `app/api/admin/donations/credentials/`, `export/` — admin API'lar
  (kalit boshqaruvi, CSV export).

### Frontend
- `/support` — to'liq Support PartnerBet sahifasi: miqdor tanlash
  (tavsiya etilgan + moslashtirilgan), to'lov usuli tanlovi, kripto QR
  kod + nusxalash, anonim/ism/xabar, uch tilli (uz/ru/en).
- `/support/thank-you` — muvaffaqiyatli to'lovdan keyin.
- `/support/supporters` — ochiq Top Supporters sahifasi.
- `/admin/donations` — Dashboard (statistika, so'nggi homiyliklar, top
  supporters, CSV export) + Payment Methods (CRUD, tartib, kalitlar).

## Lokalizatsiya

`lib/i18n/dictionaries.ts`ga `donations` bo'limi qo'shildi — barcha 3
tilda (uz/ru/en), 22 kalit, auth oqimlaridagi bilan bir xil sifat va
qamrov.

## Sifat nazorati (QA) — muhim topilmalar

Ishlab chiqish davomida quyidagi **o'zaro mos kelmaydigan qoralama
fayllar** aniqlanib, o'chirildi (izchil, yagona implementatsiya
foydasiga):
- Ikkinchi, boshqa sxema bilan `payment_methods` jadvalini yaratuvchi
  migratsiya fayli (`0031_donations.sql`) — mening
  `0031_donation_system.sql` bilan to'g'ridan-to'g'ri to'qnashardi.
- Boshqa dinamik segment nomi bilan ikkinchi webhook route
  (`[providerKey]` vs mening `[methodKey]`) — Next.js buni build vaqtida
  xato deb hisoblagan bo'lardi.
- Eskirgan tip nomlariga (`PaymentProvider` o'rniga
  `PaymentGatewayProvider`) bog'langan `genericProvider.ts` — mening
  haqiqiy tip nomlarim bilan qayta yozildi.
- `qrcode.react`ga bog'liq, ishlatilmayotgan `CryptoWalletCard.tsx` —
  o'chirildi (`/support` sahifasi o'zining ichki QR-kod logikasidan
  foydalanadi, headless `qrcode` kutubxonasi bilan).

## Tekshiruv

Barcha fayllar `tsc --strict` bilan tekshirildi. Rol-ruxsat matritsasi
(endi 18 ruxsat, 8 rol) Python orqali qayta simulyatsiya qilinib
tasdiqlandi. Barcha migratsiyalar bo'ylab dublikat jadval nomi va
git-uslubidagi conflict marker'lar qidirilib, topilmadi.

## Muhim eslatma

Kripto donationlar avtomatik blokcheyn tekshiruvidan o'tmaydi — admin
tomonidan qo'lda tasdiqlanishi kerak (`ADMIN_DONATION_GUIDE.md`, 6-band).

## Keyingi qadam

Talab bo'yicha shu yerda to'xtaymiz — keyingi versiya yo'nalishi
bo'yicha ko'rsatma kutamiz.
