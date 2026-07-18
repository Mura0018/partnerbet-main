# ADMIN_DONATION_GUIDE.md — Donations boshqaruvi

## 1. Sozlashni boshlash

`Admin > Donations` bo'limiga o'ting (`donations.manage` ruxsati kerak —
ataylab faqat Super Admin va Admin rollariga berilgan, moliyaviy
ma'lumotlar uchun tor doira).

## 2. To'lov shlyuzi qo'shish (Stripe / PayPal)

**Payment Methods** tabida **Add Payment Method** > Turi: "To'lov shlyuzi":

1. Nomini kiriting (masalan "Stripe — Karta orqali").
2. Provайderni tanlang: **Stripe** yoki **PayPal**.
3. Saqlagandan so'ng, ro'yxatdagi **"Kalitlar"** tugmasini bosing:
   - **Stripe**: Secret Key (Stripe Dashboard > Developers > API keys) va
     Webhook Signing Secret (Webhook sozlagandan keyin Stripe beradi).
   - **PayPal**: Client ID, Client Secret (PayPal Developer Dashboard'dan)
     va Webhook ID (PayPal'da webhook yaratganda beriladi).

Kalitlar **shifrlanib** saqlanadi va qayta ko'rsatilmaydi.

### Webhook URL'ni sozlash (hamkor tomonida)

Stripe/PayPal Dashboard'ida webhook manzili sifatida quyidagini
kiriting: `https://couponbet.org/api/donations/webhook/{payment_method_key}`
(`{payment_method_key}` — to'lov usulini yaratganda ko'rsatilgan slug,
masalan `stripe` yoki `paypal`).

## 3. Kripto hamyon qo'shish

**Add Payment Method** > Turi: "Kripto hamyon":

1. Nomi (masalan "USDT (TRC20)").
2. Kripto belgisi (USDT, BTC, ETH, SOL va h.k.).
3. Tarmoq (TRC20, ERC20, Mainnet va h.k. — muhim, chunki noto'g'ri
   tarmoqqa yuborilgan mablag' yo'qolishi mumkin).
4. Wallet Address — to'liq, tekshirilgan manzil.

Hech qanday API kalit kerak emas — QR kod avtomatik generatsiya qilinadi.

## 4. To'lov usullarini tartibga solish

Ro'yxatdagi ↑/↓ tugmalari orqali tartibni o'zgartiring — bu tartib
`/support` sahifasidagi tanlov ro'yxatida aks etadi. Faol/Faolsiz
tugmasi orqali vaqtincha o'chirib qo'yish mumkin (o'chirmasdan).

## 5. Dashboard

**Dashboard** tabida:
- Jami daromad, bugungi/haftalik/oylik statistika.
- So'nggi 10 ta homiylik (holati bilan: pending/completed/failed).
- Top 5 homiy.
- **Export CSV** — barcha homiyliklar tarixini CSV formatida yuklab olish.

## 6. Kripto donationlarni tasdiqlash

Kripto orqali yuborilgan homiylik avtomatik tasdiqlanmaydi (blokcheyn
kuzatuvi joriy tizimga kiritilmagan — sabab `DONATION_SYSTEM.md`da).
Donor "Yubordim" formasini to'ldirgach, yozuv **"pending"** holatida
paydo bo'ladi. Admin hamyoningizda mablag' kelganini tasdiqlagach,
**Dashboard > So'nggi homiyliklar**dan yozuvni toping va holatini
qo'lda "completed"ga o'zgartiring (to'g'ridan-to'g'ri Supabase
Dashboard orqali yoki kelajakda qo'shiladigan tezkor tugma orqali).

## 7. Xavfsizlik eslatmalari

- Barcha to'lov shlyuzi kalitlari shifrlanadi (AES-256-GCM) — hech qachon
  brauzerga chiqmaydi.
- Webhook so'rovlari imzo orqali tekshiriladi — soxta "to'lov
  muvaffaqiyatli" xabarlarini hech kim yubora olmaydi.
- Har bir o'zgarish audit qilinadi.
