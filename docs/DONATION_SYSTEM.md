# DONATION_SYSTEM.md — Version 1.2.0

## Arxitektura falsafasi

Bu tizim Football Data (Phase 3c) va Live Streaming (v1.1.0) provider
abstraktsiyasi bilan bir xil naqshni davom ettiradi, lekin ikki xil
holatni farqlaydi:

- **To'lov shlyuzlari (Stripe, PayPal)** — bular **haqiqiy, barqaror,
  keng hujjatlashtirilgan** API'lar (Football Data provайderlari kabi),
  shuning uchun ularga **haqiqiy, to'liq ishlaydigan adapter** yozildi
  (Stripe Checkout Sessions API, PayPal Orders v2 API).
- **Kripto donationlar (USDT/BTC/ETH/SOL)** — bular umuman "provider
  adapter" emas. Kripto uchun umumiy to'lov-shlyuzi API'si yo'q — donor
  hamyon manzilini ko'radi, QR kod orqali yoki qo'lda nusxalab, o'zi
  to'g'ridan-to'g'ri blokcheynga yuboradi. Shuning uchun bu yo'nalish
  **kod darajasida alohida, soddaroq**: faqat manzil + QR kod +
  "yubordim" deb belgilash formasi — avtomatik blokcheyn tekshiruvi
  amalga oshirilmagan (ko'lam chegarasi, pastga qarang).
- **"Other providers" (kelajakdagi noma'lum shlyuzlar)** — Live
  Streaming'dagi kabi, umumiy, hujjatlashtirilgan shartnoma asosida
  ishlaydigan `GenericPaymentProvider` qo'shildi — haqiqiy noma'lum
  xizmat nomi o'ylab topilmagan.

## Arxitektura

```
PaymentGatewayProvider interfeysi (lib/donations/types.ts)
  createCheckoutSession(), verifyWebhook()
        │
   ┌────┼─────────────┬──────────────┐
   ▼           ▼              ▼
StripeProvider  PayPalProvider  GenericPaymentProvider
(haqiqiy API)   (haqiqiy API)   (umumiy shartnoma)
   │
lib/donations/registry.ts — payment_methods qatoridan + shifrlangan
                             kalitdan instansiya yaratadi
   │
lib/security/encryptedCredentials.ts — Live Streaming bilan BIR XIL
                                        shifrlash moduli
   │
app/api/donations/* — checkout, webhook, crypto-report, top-supporters
```

Kripto donationlar bu diagrammada yo'q — ular `/support` sahifasida
to'g'ridan-to'g'ri `payment_methods.wallet_address`ni ko'rsatish va
QR kod generatsiya qilish orqali ishlaydi, hech qanday tashqi API
chaqirilmaydi.

## Xavfsizlik qatlamlari

### Shifrlash — dublikat qilinmadi

Live Streaming (v1.1.0) uchun yozilgan `lib/security/encryption.ts`
(AES-256-GCM) shu bosqichda ham ishlatildi. Ishlab chiqish davomida
"streaming" va "donation" xususiyatlari o'zining alohida
`credentials.ts` faylida deyarli bir xil "shifrlash + saqlash" mantig'ini
takrorlagani aniqlanib, **umumiy, namespace asosidagi modul**
(`lib/security/encryptedCredentials.ts`) yaratildi — ikkalasi endi shunga
yupqa wrapper.

### Webhook tekshiruvi (soxta "to'lov muvaffaqiyatli" xabarlarini oldini olish)

- **Stripe**: `Stripe-Signature` header'idagi HMAC-SHA256 imzoni
  `crypto.timingSafeEqual` bilan solishtirish + 5 daqiqalik replay-himoya.
- **PayPal**: PayPal'ning o'z `verify-webhook-signature` API'siga qayta
  so'rov yuborish (PayPal oddiy HMAC emas, markazlashgan tekshiruv
  talab qiladi).
- Har ikkala holatda ham: tekshiruv muvaffaqiyatsiz bo'lsa, donation
  holati **hech qachon** yangilanmaydi — faqat `donation_webhook_log`ga
  "verified: false" sifatida yoziladi (admin ko'radi, tizim ishonmaydi).

### Ma'lumotlar bazasi darajasidagi himoya

- `donations` jadvali — **hech qanday public RLS siyosati yo'q** (hatto
  insert ham). Barcha yaratish faqat server route'lar orqali
  (`/api/donations/checkout`, `/api/donations/crypto-report`) — miqdor
  chegarasi, valyuta ro'yxati, xabar uzunligi bitta joyda majburlanadi.
- `payment_methods` — ochiq o'qish xavfsiz (bu jadvalda hech qanday
  maxfiy ma'lumot yo'q — kalitlar alohida, shifrlangan).
- Input validatsiyasi: `amount > 0 and <= 1,000,000`, valyuta
  `USD/EUR/UZS` bilan cheklangan (`CHECK` constraint) — chetlab
  o'tib bo'lmaydi.
- Rate limiting: bitta to'lov usuli uchun 15 daqiqada 10 martadan ko'p
  checkout/crypto-report so'rovi rad etiladi.

### RBAC

Yangi ruxsat: `donations.manage` — **ataylab faqat** `super_admin` va
`admin`ga biriktirilgan (Content Manager'ga emas, football/streaming
ruxsatlaridan farqli) — moliyaviy ma'lumotlar kontent boshqaruvidan
tor doirada saqlanishi kerak degan qaror.

## Donor tajribasi

- Anonim yoki ism bilan (`is_anonymous`).
- Ixtiyoriy qisqa xabar (500 belgigacha).
- Top Supporters'da ko'rinish (`is_public`, donor tanlaydi).
- Email hech qachon ochiq ko'rsatilmaydi
  (`/api/donations/top-supporters` faqat xavfsiz maydonlarni qaytaradi).

## Ko'lam chegarasi (ataylab, hujjatlashtirilgan)

Kripto donationlar **avtomatik blokcheyn tekshiruvidan o'tmaydi** — bu
alohida infratuzilma (blokcheyn tugunlariga ulanish yoki uchinchi tomon
tranzaksiya kuzatuv xizmati) talab qiladi va joriy so'rov doirasidan
tashqarida. Buning o'rniga donor "yubordim" formasini to'ldiradi
(tranzaksiya хeш bilan, ixtiyoriy), va admin holatni qo'lda
"completed"ga o'zgartiradi (Dashboard > So'nggi homiyliklar).

## Kelajakka tayyorgarlik (faqat arxitektura, funksiya emas)

| Kelajakdagi funksiya | Qanday tayyor |
|---|---|
| Oylik obuna | `PaymentGatewayProvider` interfeysi kengaytirilishi mumkin (`createSubscription()`) — mavjud kod buzilmaydi |
| Premium a'zolik / badge | `profiles.role_id` allaqachon bor; yangi "supporter" darajasi keyinroq qo'shilishi mumkin |
| Takroriy donation | `donations`ga `recurring_donation_id` FK qo'shish — schema o'zgarishi minimal |
| Raqamli mukofotlar | `donations.status='completed'` hodisasi allaqachon audit qilinadi — kelajakda shu hodisaga ulanadigan mexanizm qo'shish mumkin |

Talab bo'yicha bular **hozir amalga oshirilmadi** — faqat kengaytirish
nuqtalari hujjatlashtirildi.

## Yangi/o'zgargan fayllar

| Fayl | Vazifasi |
|---|---|
| `supabase/migrations/0031_donation_system.sql` | To'liq sxema |
| `lib/security/encryptedCredentials.ts` | Umumiy shifrlash moduli (streaming + donations) |
| `lib/donations/types.ts` | `PaymentGatewayProvider` interfeysi |
| `lib/donations/providers/stripeProvider.ts` | Haqiqiy Stripe Checkout adapter |
| `lib/donations/providers/paypalProvider.ts` | Haqiqiy PayPal Orders adapter |
| `lib/donations/providers/genericProvider.ts` | Umumiy shartnoma shablon |
| `lib/donations/registry.ts`, `credentials.ts` | Provider yaratish + shifrlangan kalit |
| `app/api/donations/checkout/`, `crypto-report/`, `webhook/[methodKey]/`, `top-supporters/` | Ochiq API'lar |
| `app/api/admin/donations/credentials/`, `export/` | Admin API'lar |
| `app/admin/donations/page.tsx` | Dashboard + Payment Methods |
| `app/support/page.tsx`, `thank-you/`, `supporters/` | Ochiq donation sahifalari |

## Tekshiruv

Barcha fayllar `tsc --strict` bilan tekshirildi. Ishlab chiqish davomida
bir nechta o'zaro **mos kelmaydigan** qoralama fayl (ikkinchi
`payment_methods` jadval ta'rifi boshqa migratsiya raqami bilan, boshqa
parametr nomi bilan ikkinchi webhook route, eskirgan tip nomlariga
bog'langan komponent) aniqlanib, izchil, yagona implementatsiya foydasiga
olib tashlandi — batafsil `CHANGELOG_V1_2_0.md`da.
