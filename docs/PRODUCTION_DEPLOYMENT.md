# PRODUCTION_DEPLOYMENT.md — PartnerBet Pro V2

To'liq, boshidan oxirigacha production'ga chiqarish qo'llanmasi.

## 1-QADAM — Supabase loyihasini yaratish

1. [supabase.com](https://supabase.com) > **New Project**.
2. Loyiha yaratilgach, **Settings > API** bo'limidan quyidagilarni nusxalang:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` kaliti → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` kaliti → `SUPABASE_SERVICE_ROLE_KEY` (**hech kimga bermang**)

## 2-QADAM — Ma'lumotlar bazasi sxemasi

1. Supabase Dashboard > **SQL Editor** > **New query**.
2. `supabase/schema.sql` faylining **butun mazmunini** nusxalab, joylashtiring.
3. **Run** tugmasini bosing. (29 migratsiya, ~1550 qator — bir necha soniyada tugaydi.)
4. Xatosiz o'tishi kerak. Agar xato chiqsa — loyiha allaqachon qisman
   ishga tushirilgan bo'lishi mumkin; SQL Editor xato xabaridagi jadval
   nomini tekshirib, kerak bo'lsa shu jadvalni qo'lda o'chirib qayta
   urinib ko'ring.

## 3-QADAM — Storage bucket'lar

Migratsiya avtomatik ravishda `media` va `apk` bucket'larini yaratadi
(0019-migratsiya). Tekshirish: Dashboard > **Storage** — ikkala bucket
ham "Public" sifatida ko'rinishi kerak.

## 4-QADAM — Birinchi Super Admin

1. Dashboard > **Authentication > Users > Add user** — o'z email/parolingiz
   bilan (✅ "Auto Confirm User" belgisini qo'ying).
2. Yaratilgan foydalanuvchining **User UID**'ni nusxalang.
3. **SQL Editor**'da:
   ```sql
   update profiles
   set role_id = (select id from roles where key = 'super_admin')
   where id = 'BU_YERGA_USER_UID';
   ```

## 5-QADAM — Vercel'ga deploy

1. Repozitoriyni GitHub/GitLab'ga yuklang (yoki Vercel CLI orqali
   to'g'ridan-to'g'ri papkadan deploy qiling).
2. [vercel.com](https://vercel.com) > **New Project** > repozitoriyni tanlang.
3. **Environment Variables** bo'limiga quyidagilarni qo'shing
   (`.env.example`ga qarang):

   | O'zgaruvchi | Qiymat |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | 1-qadamdan |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 1-qadamdan |
   | `SUPABASE_SERVICE_ROLE_KEY` | 1-qadamdan |
   | `NEXT_PUBLIC_SITE_NAME` | `PartnerBet` |
   | `NEXT_PUBLIC_SITE_URL` | `https://couponbet.org` (yoki sizning domeningiz) |
   | `CRON_SECRET` | Tasodifiy uzun matn (masalan `openssl rand -hex 32`) |

4. **Deploy** tugmasini bosing.

## 6-QADAM — Domen

1. Vercel > loyiha > **Settings > Domains** > `couponbet.org`ni qo'shing.
2. Domen provayderingizda ko'rsatilgan DNS yozuvlarini qo'shing.
3. `NEXT_PUBLIC_SITE_URL` environment variable qiymati haqiqiy domen bilan
   mos kelishini tekshiring (keyin qayta deploy qiling).

## 7-QADAM — Supabase Auth URL sozlamalari (muhim!)

Dashboard > **Authentication > URL Configuration**:
- **Site URL**: `https://couponbet.org`
- **Redirect URLs**ga qo'shing:
  - `https://couponbet.org/auth/reset-password`
  - `https://couponbet.org/auth/verify-email`

Bu qadam o'tkazib yuborilsa, parolni tiklash va email tasdiqlash
havolalari ishlamaydi.

## 8-QADAM — Vercel Cron (Link Health)

`vercel.json` fayli avtomatik ravishda har 6 soatda
`/api/cron/check-affiliate-links`ni chaqiradi. Bu Vercel'ning Pro yoki
undan yuqori rejasida avtomatik ishlaydi (Hobby rejada cron
so'rovlari kunига 1 marta cheklangan bo'lishi mumkin — Vercel
hujjatlarini tekshiring).

## 9-QADAM — Kontentni sozlash (birinchi kirishdan keyin)

Admin panelga (`/auth/login`) kirib, tartib bilan:

1. **Sozlamalar** — sayt nomi, logotip, ranglar, aloqa ma'lumotlari,
   ijtimoiy tarmoq havolalari.
2. **Sozlamalar > API kalitlar** — kamida bitta Football Data provayder
   tanlang va kalitini kiriting (aks holda Football Center bo'sh
   holatda qoladi — bu xato emas, professional bo'sh holat).
3. **Football Center** — Featured Leagues qo'shing (masalan Premier
   League, La Liga).
4. **Affiliates** — hamkorlaringizni qo'shing.
5. **Foydalanuvchilar** — jamoa a'zolarini Supabase Dashboard orqali
   yaratib, shu yerdan rol bering.

## 10-QADAM — Yakuniy tekshiruv

- [ ] Bosh sahifa ochiladi, dizayn to'g'ri ko'rinadi
- [ ] `/auth/login` orqali kirish ishlaydi
- [ ] `/football`, `/blog`, `/partners`, `/apk`, huquqiy sahifalar ochiladi
- [ ] Admin panelda kamida bitta post/hamkor/banner qo'shib ko'ring
- [ ] `sitemap.xml` va `robots.txt` to'g'ri ko'rinadi
      (`https://couponbet.org/sitemap.xml`)

## Muammolarni bartaraf etish

| Muammo | Yechim |
|---|---|
| "relation does not exist" xatosi | `schema.sql` to'liq ishga tushirilmagan — qaytadan SQL Editor'da bajaring |
| Admin panelga kira olmayapman | `profiles.role_id` to'g'ri o'rnatilganini tekshiring (4-qadam) |
| Parolni tiklash havolasi ishlamayapti | 7-qadam (Redirect URLs) o'tkazib yuborilgan |
| Football Center bo'sh | Kutilgan holat — provayder/kalit hali sozlanmagan (9-qadam, band 2) |
| Push bildirishnoma ishlamayapti | VAPID kalitlar Sozlamalar > API kalitlar'da kiritilmagan |
