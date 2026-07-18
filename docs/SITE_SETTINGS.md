# SITE_SETTINGS.md — Phase 3a: Site Settings Panel

## Ko'lam eslatmasi

Phase 3 to'liq so'rovi 4 ta katta quyi-tizimni o'z ichiga oladi: Site Settings,
Affiliate Manager, Football Center, News CMS. Bular birgalikda o'nlab fayl va
bir nechta yangi jadval talab qiladigan alohida ishlar. Sifatni saqlash
uchun (audit → ishlab chiqish → tekshirish → tasdiqlash tsikli, avvalgi
bosqichlarda ishlagani kabi) ular **3a/3b/3c/3d** deb bo'lindi.

**Bu yetkazilma — 3a: Site Settings.** 3b (Affiliate Manager), 3c (Football
Center), 3d (News CMS + Rich Text Editor) navbatdagi xabarlarda davom
ettiriladi.

## Yangi admin bo'lim: `/admin/settings`

7 ta bo'lim (`settings.manage` ruxsati bilan himoyalangan, middleware +
RLS ikkala darajada):

| Bo'lim | Boshqaradi |
|---|---|
| Umumiy | Sayt nomi, slogan, qo'llab-quvvatlash emaili/telefon, footer tavsifi |
| Brend | Logotip, favicon (haqiqiy yuklash), mavzu ranglari (asosiy/ikkinchi/fon) |
| Ijtimoiy tarmoq | Facebook, Instagram, Telegram, Twitter havolalari |
| SEO | Standart sarlavha va tavsif (meta teglar) |
| Analitika | Google Analytics ID, Meta Pixel ID (saqlash; ulash Phase 5) |
| API kalitlar | Football API kaliti (**darhol ishlaydi**), Push kalitlari (saqlanadi, yuborish Phase 4) |
| Texnik ishlar | Sayt bo'yicha texnik ishlar rejimi yoqish/o'chirish |

## Muhim arxitektura qarorlari

### 1. Maxfiy kalitlar hech qachon `site_settings`da saqlanmaydi

`site_settings` jadvali **ochiq o'qish** siyosatiga ega (`using (true)`) —
chunki sayt render qilish uchun unga kerak (sayt nomi, ranglar va h.k.
login'siz yuklanishi kerak). Agar Football API kaliti shu jadvalga
qo'yilganda, **har qanday anonim tashrifchi** uni Supabase REST API orqali
to'g'ridan-to'g'ri o'qib olishi mumkin bo'lardi.

Shuning uchun yangi, alohida **`api_credentials`** jadvali yaratildi:
- RLS yoqilgan, lekin **hech qanday siyosat yo'q** — na `anon`, na
  `authenticated` uni o'qiy/yoza olmaydi. Faqat `service_role` kaliti
  (RLS'ni butunlay chetlab o'tadi) unga kira oladi.
- Bu kalitga faqat **server-only** kod tegishi mumkin: `/api/admin/secrets`
  route'i (admin `settings.manage` ekanini avval o'zining sessiyasi orqali
  tekshiradi, so'ng `service_role` bilan yozadi) va `/api/football/*`
  route'lari (o'qish uchun).
- Admin panel hech qachon saqlangan qiymatni **qayta ko'rmaydi** — faqat
  "sozlangan / sozlanmagan" holatini. Bu standart "write-only secret"
  pattern (masalan GitHub Actions Secrets shunday ishlaydi).

### 2. Mavzu ranglari — CSS o'zgaruvchilar orqali, qayta build shart emas

Ranglar avval Tailwind config'da qattiq yozilgan edi (`#00A3FF` va h.k.).
Endi ular CSS custom property'lar orqali aniqlanadi
(`globals.css`dagi `:root { --color-accent: 0 163 255; ... }`), Tailwind
esa shu o'zgaruvchilarga ishora qiladi (`rgb(var(--color-accent) / <alpha-value>)`).

Admin rang tanlaganda, `app/layout.tsx` (Server Component) so'rov vaqtida
`site_settings.theme`ni o'qiydi va agar moslashtirilgan qiymat bo'lsa,
`<head>`ga kichik `<style>:root{--color-accent: R G B}</style>` qo'shadi —
**butun sayt darhol yangi rangda ko'rinadi, deploy yoki build shart emas.**

### 3. Media yuklash — Site Settings uchun maqsadli, to'liq Media Library emas

`lib/media/upload.ts` — logotip/favicon uchun haqiqiy, to'liq ishlaydigan
yuklash (Storage + `media` jadvali yozuvi). Bu **to'liq Media Library**
(galereya, drag-drop tartiblash, rasm optimizatsiyasi) emas — bu alohida,
kattaroq ish sifatida Phase 4'da rejalashtirilgan. Hozirgi yuklash
funksiyasi o'zi to'liq va ishlaydi, faqat qamrovi tor (bitta fayl,
bitta maqsad uchun).

### 4. Texnik ishlar rejimi — middleware darajasida, admin uchun bypass bilan

`middleware.ts` endi ikki vazifani bajaradi: (1) `/admin/*` himoyasi
(Phase 2'dan), (2) **barcha boshqa** sahifalar uchun texnik ishlar holatini
tekshirish. Yoqilgan bo'lsa va tashrifchi admin bo'lmasa —
`/maintenance`ga qayta yo'naltiriladi (`NextResponse.rewrite`, URL
o'zgarmaydi). Admin/xodim hisoblar odatdagidek ko'rishda davom etadi.

### 5. Sayt nomi va SEO — endi haqiqatan ham ishlaydi

`app/layout.tsx`dagi `generateMetadata()` endi `site_settings`dan sayt
nomi va SEO standart qiymatlarini o'qiydi — brauzer tab sarlavhasi,
Open Graph, Twitter Card barchasi admin kiritgan qiymatlarni aks ettiradi
(agar bo'sh bo'lsa, statik standart qiymatlarga qaytadi).

## Yangi migratsiya

`0024_site_settings_phase3.sql`:
- `site_settings`ga yangi kalitlar: `footer`, `maintenance`, `branding`
- `theme` kalitiga `secondary_color`/`background_color` qo'shildi
- Yangi jadval: `api_credentials` (yuqorida tavsiflangan xavfsiz naqsh)

## Yangi/o'zgargan fayllar

| Fayl | Vazifasi |
|---|---|
| `lib/supabasePublic.ts` | Server Component'lar uchun cookie'siz ochiq klient |
| `lib/theme.ts` | Hex→RGB, CSS o'zgaruvchi in'ektsiyasi |
| `lib/media/upload.ts` | Rasm yuklash (Storage + media jadvali) |
| `lib/auth/apiCredentials.ts` | Server-only maxfiy kalit o'qish/yozish |
| `app/api/admin/secrets/route.ts` | Maxfiy kalitlarni boshqarish API'i |
| `app/admin/settings/page.tsx` | 7-bo'limli Sozlamalar UI |
| `app/maintenance/page.tsx` | Texnik ishlar sahifasi |
| `app/icon.tsx` | Endi admin yuklagan favicon'ni ishlatadi (bor bo'lsa) |
| `middleware.ts` | Texnik ishlar tekshiruvi qo'shildi |
| `app/layout.tsx` | Dinamik metadata + mavzu ranglari |
| `tailwind.config.ts`, `app/globals.css` | CSS o'zgaruvchi asosidagi ranglar |
| `app/page.tsx` | Sayt nomi/logotip/footer/ijtimoiy tarmoq dinamik |
| `app/api/football/fixtures/route.ts`, `standings/route.ts` | DB'dan kalit o'qiydi (env fallback bilan) |

## Tekshiruv

Barcha yangi/o'zgargan fayllar `tsc --strict` bilan tekshirildi. Faqat
oldindan ma'lum ikkita soxta xato qoldi (`key` prop — `@types/react`
o'rnatilmagan tekshiruv muhiti sababli, avvalgi bosqichlardagi bilan bir xil).
