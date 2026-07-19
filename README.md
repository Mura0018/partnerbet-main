# PARTNERBET — Ishga tushirish yo'riqnomasi

Bu yo'riqnoma **kod yozishni talab qilmaydi** — faqat tugmalar bosiladi va
kalitlar joylashtiriladi. Har bir qadamni tartibi bilan bajaring.

----

## 1-QADAM — Supabase (ma'lumotlar bazasi) yaratish

1. https://supabase.com ga kiring, bepul akkaunt oching.
2. **"New Project"** tugmasini bosing, nom bering (masalan `partnerbet`), parol
   o'rnating, mintaqa tanlang (masalan Frankfurt — Osiyoga eng yaqin serverlardan).
3. Loyiha yaratilgach, chap menyudan **SQL Editor** ga o'ting.
4. Ushbu papkadagi `supabase/schema.sql` faylining barcha matnini nusxalab,
   SQL Editor'ga joylashtiring va **"Run"** tugmasini bosing.
   → Bu barcha jadvallarni (insights, blog, apk, ads, va h.k.) avtomatik yaratadi.
5. Chap menyudan **Settings > API** ga o'ting. Bu yerdan 3 ta qiymatni nusxalab
   oling:
   - `Project URL` → bu `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` kaliti → bu `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` kaliti → bu `SUPABASE_SERVICE_ROLE_KEY` (buni hech kimga
     ko'rsatmang!)

### Birinchi admin foydalanuvchini yaratish
1. Supabase'da **Authentication > Users > Add user** tugmasini bosing.
   (Bu hisob uchun `profiles` jadvalida avtomatik "user" rolli yozuv yaratiladi —
   qo'shimcha SQL kerak emas.)
2. Yaratilgan foydalanuvchining **User UID** qiymatini nusxalang.
3. **SQL Editor**'ga qayting va shu buyruqni bajaring (UID'ni almashtiring) —
   bu hisobni **Super Admin** qiladi:
   ```sql
   update profiles
   set role_id = (select id from roles where key = 'super_admin')
   where id = 'BU_YERGA_USER_UID';
   ```
4. Endi shu email/parol bilan `/admin/login` sahifasidan kira olasiz.

> Rollar haqida: `super_admin` (hammasi), `admin` (rollardan tashqari hammasi),
> `editor` (faqat kontent: blog, football news, match insights, media).
> Batafsil: `DATABASE_DOCUMENTATION.md`.

---

## 2-QADAM — API-FOOTBALL kaliti olish

1. https://www.api-football.com ga kiring, bepul yoki pullik reja tanlang.
2. Dashboard'dan **API Key** ni nusxalang.
3. Buni keyingi qadamda `API_FOOTBALL_KEY` sifatida joylashtirasiz.

---

## 3-QADAM — Kalitlarni joylashtirish

1. `.env.example` faylini nusxalab, nomini `.env.local` ga o'zgartiring.
2. 1- va 2-qadamda olingan barcha kalitlarni tegishli qatorlarga joylashtiring.

Namuna:
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
API_FOOTBALL_KEY=abcdef1234567890
```

---

## 4-QADAM — Saytni internetga chiqarish (Vercel)

Kod yozish shart emas — faqat GitHub va Vercel orasida bog'lash kerak.

1. Bu loyiha papkasini GitHub'ga yuklang (agar bilmasangiz — GitHub Desktop
   dasturi orqali "drag & drop" qilib yuklash mumkin, u yerda "Publish
   repository" tugmasi bor).
2. https://vercel.com ga kiring → **"Add New Project"** → GitHub repo'ni
   tanlang → **"Import"**.
3. **"Environment Variables"** bo'limida `.env.local` faylidagi barcha
   qatorlarni bittalab joylashtiring (nom va qiymat).
4. **"Deploy"** tugmasini bosing. 2-3 daqiqadan so'ng saytingiz tayyor bo'ladi.

Shundan keyin sayt **avtomatik ishlaydi**:
- Admin panelda insight/blog/APK/reklama qo'shsangiz — darhol saytda ko'rinadi
- Live hisoblar API-FOOTBALL'dan avtomatik yangilanadi
- Har bir o'zgarishda kod yozish shart emas, faqat admin panel formalarini
  to'ldirasiz

---

## Admin panel bo'limlari

| Bo'lim | Manzil | Vazifasi |
|---|---|---|
| Dashboard | `/admin/dashboard` | Umumiy statistika |
| Insights | `/admin/insights` | Match tahlillarini qo'shish/tahrirlash |
| Blog | `/admin/blog` | SEO maqolalar |
| APK | `/admin/apk` | Ilova versiyasini yangilash |
| Banners | `/admin/banners` | Har xil o'lchamdagi bannerlar, maqsadlash, rejalashtirish |
| Affiliates | `/admin/affiliates` | Hamkorlar, promo-kodlar, Smart Redirect, Link Health |
| Football Center | `/admin/football` | Featured Leagues/Matches, Videos (provayder tanlovi — Sozlamalar) |
| Live Streaming | `/admin/streaming` | Rasmiy oqim provайderlari, o'yinga biriktirish (v1.1.0) |
| Donations | `/admin/donations` | To'lov usullari, statistika, CSV export (v1.2.0) |
| Donations | `/admin/donations` | To'lov usullari, kripto hamyonlar, xayriya statistikasi (v1.2.0) |
| Football News | `/admin/football-news` | Football yangiliklari (Rich Text Editor) |
| Kategoriyalar | `/admin/categories` | Blog/Football News kategoriyalari |
| Teglar | `/admin/tags` | Blog uchun global teglar |
| Media Library | `/admin/media` | Barcha yuklangan fayllar galereyasi |
| Push Notifications | `/admin/push` | Obunachilarga bildirishnoma yuborish |

---

## Hozircha stub (keyingi bosqichda to'ldiriladi)

- Push notifications (Web Push / FCM integratsiyasi) — Phase 4
- Support chat backend (realtime xabar almashish) — Phase 4
- Ko'p tillilik uchun to'liq tarjima fayllari (hozir EN asosiy) — keyinroq
- Rol boshqaruvi UI (hozir SQL orqali; dashboard'dan boshqarish) — Phase 3

Bularni alohida so'rasangiz, navbat bilan qo'shib boraman.

---

## Muhim eslatma

Footer va hero qismidagi 18+ / responsible gambling / affiliate disclosure
matnlarini o'chirmang — bular litsenziyalangan affiliate sifatida ishlash
uchun zarur.
