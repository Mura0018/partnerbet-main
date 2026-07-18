# AUTHENTICATION.md — PartnerBet Pro V2 (Phase 2)

## 1. Arxitektura umumiy ko'rinishi

Autentifikatsiya **Supabase Auth (GoTrue)** ustiga qurilgan — parol hash'lash,
JWT imzolash, email yuborish infratuzilmasi, refresh token generatsiyasi kabi
kriptografik jarayonlar **qayta yozilmagan**, chunki bu sohalarni qo'lda
qayta implementatsiya qilish professional amaliyotga zid (xato qilish xavfi
yuqori, Supabase'niki esa auditlangan va ishonchli). Ustiga qo'shilgan qism:
brute-force himoya, granular RBAC, ikki bosqichli parol tekshiruvi va 3 tilli
UI.

```
Brauzer (React) → /api/auth/* route'lar (Next.js server) → Supabase Auth
                                                           → Postgres (RLS)
```

## 2. Sahifalar

| Yo'l | Vazifasi |
|---|---|
| `/auth/login` | Admin/xodim kirishi (yagona kirish nuqtasi) |
| `/auth/forgot-password` | Parolni tiklash havolasini so'rash |
| `/auth/reset-password` | Email havolasi orqali yangi parol o'rnatish |
| `/auth/verify-email` | Email tasdiqlash havolasi qaytadigan sahifa |
| `/admin/profile` | Parolni o'zgartirish, barcha qurilmalardan chiqish |
| `/admin/users` | Rol boshqaruvi (`users.manage` huquqi kerak) |

**Muhim:** PartnerBet ochiq ro'yxatdan o'tish (public self-registration)ga ega
emas — bu bahis platformasi emas, foydalanuvchi hisoblari kerak emas. Yangi
admin/xodim hisoblari **faqat mavjud administrator tomonidan** Supabase
Dashboard (Authentication > Users > Add user) orqali yaratiladi, so'ng
`/admin/users`da unga rol beriladi. `/auth/register` va
`/api/auth/register` ataylab **mavjud emas**.

Eski `/admin/login` **olib tashlandi** — endi bitta, markazlashgan
`/auth/login` ishlatiladi (ikki xil login logikasi = dublikat kod, xato
xavfi).

## 3. Email tasdiqlash, Forgot/Reset/Change Password

Barchasi Supabase Auth'ning tayyor, xavfsiz mexanizmlari orqali:

- **Yangi admin hisob** → mavjud administrator Supabase Dashboard'da yaratadi
  (public `signUp()` chaqirilmaydi — bu ochiq ro'yxatdan o'tish emas).
  Dashboard'da "Auto Confirm User" yoqilsa email tasdiqlash shart emas;
  yoqilmasa, standart Supabase tasdiqlash xati yuboriladi va `/auth/verify-email`
  havolani qabul qiladi.
- **Forgot password** → `supabase.auth.resetPasswordForEmail()` — email
  mavjud/mavjud emasligidan qat'iy nazar bir xil javob qaytariladi
  (account enumeration oldini olish uchun).
- **Reset password** → email havolasi `/auth/reset-password`ga URL hash orqali
  vaqtinchalik "recovery" sessiya bilan qaytaradi → `supabase.auth.updateUser()`.
- **Change password** (login qilingan holatda) → `/api/auth/change-password`
  route'i avval **joriy parolni qayta autentifikatsiya orqali tekshiradi**
  (faqat sessiya borligi yetarli emas — brauzer ochiq qolgan bo'lishi mumkin),
  so'ng `updateUser()` chaqiradi.

**Supabase loyihasida sozlash kerak** (Dashboard > Authentication > URL
Configuration): `Site URL` va `Redirect URLs`ga
`https://SIZNING_DOMEN/auth/reset-password` va `/auth/verify-email`
qo'shilishi shart — aks holda email havolalari ishlamaydi.

## 4. Refresh Token Rotation va Sessiya boshqaruvi

Qayta implementatsiya qilinmadi — **Supabase JS SDK (`@supabase/ssr`) buni
o'zi, to'g'ri sozlanganda, avtomatik bajaradi**: har safar access token
yangilanganda, eski refresh token bekor qilinadi va yangisi beriladi
(rotation). Bizning ishimiz — buni **to'g'ri ulash**:

- `middleware.ts` — har bir `/admin/*` so'rovida `getSession()` chaqiradi,
  bu kerak bo'lsa avtomatik yangilaydi va cookie'larni **to'g'ri** yozadi
  (Phase 0'da tuzatilgan — asl versiyada cookie yozish no-op edi, bu esa
  amalda rotation'ni buzardi).
- `lib/supabaseServer.ts` — Route Handler'lar uchun xuddi shunday to'g'ri
  cookie ulanishi.

**"Meni eslab qol" (Remember Me):** ishonch bildirilmasa, sessiya cookie'lari
`maxAge`siz (session-only) o'rnatiladi — brauzer yopilganda avtomatik
tugaydi. Bu shunchaki vizual belgi emas — `lib/supabaseServer.ts`dagi
`persistSession` parametri orqali haqiqiy cookie xatti-harakatini
o'zgartiradi.

**Barcha qurilmalardan chiqish:** `/admin/profile`dagi tugma
`supabase.auth.signOut({ scope: 'global' })` chaqiradi — bu foydalanuvchining
BARCHA refresh token'larini serverda bekor qiladi.

## 5. Brute-force himoya va Login Rate Limiting

Yangi jadval: `login_attempts` (RLS bilan himoyalangan — **hech qanday
siyosat yo'q**, faqat service-role kaliti orqali server yoza/o'qiy oladi).

`/api/auth/login` route'i:
1. So'ralgan email va so'rov IP manzili bo'yicha oxirgi 15 daqiqadagi
   **muvaffaqiyatsiz** urinishlar sonini tekshiradi.
2. Bitta email uchun ≥5 marta yoki bitta IP uchun ≥20 marta (turli
   email bilan taqsimlangan hujumlardan himoya) — `429 Too Many Requests`
   qaytaradi, aniq necha daqiqadan keyin qayta urinish mumkinligi bilan.
3. Har bir urinish (muvaffaqiyatli yoki yo'q) `login_attempts`ga yoziladi.

Bu **haqiqiy, backend darajasidagi** himoya — frontend'da soxta "loading"
animatsiyasi emas, chunki tekshiruv butunlay server route'ida, brauzer
kodini chetlab o'tib bo'lmaydi.

## 6. Parol siyosati

`lib/auth/password.ts` — bitta joyda yozilgan, **ham frontend (darhol
fikr-mulohaza), ham backend (`/api/auth/change-password`, parolni tiklash
oqimi)da ishlatiladi**:

- Kamida 10 belgi
- Kamida 1 katta, 1 kichik harf, 1 raqam, 1 maxsus belgi
- Oddiy/keng tarqalgan parollar ro'yxatiga qarshi tekshiruv
- Parol email manzilga teng bo'lmasligi

Frontend tekshiruvi UX uchun (darhol ko'rinadigan kuch indikatori); backend
tekshiruvi **majburiy** — frontend soxtalashtirilsa ham (masalan to'g'ridan-
to'g'ri API'ga so'rov yuborilsa) parol siyosati buzilmaydi.

## 7. To'liq RBAC — 8 rol

| Rol | Ruxsatlar soni | Qamrovi |
|---|---|---|
| `super_admin` | 15/15 | Hammasi, jumladan rollarni boshqarish |
| `admin` | 14/15 | Hammasi, `roles.manage`dan tashqari |
| `content_manager` | 7 | Blog, football news, match insights, media, taksonomiya, FAQ, navigatsiya |
| `editor` | 4 | Blog, football news, match insights, media (yaratish darajasida) |
| `moderator` | 3 | Support, match insights, FAQ |
| `affiliate_manager` | 3 | Promotions, advertisements, APK |
| `support` | 1 | Faqat support suhbatlari |
| `user` | 0 | Ochiq ro'yxatdan o'tgan oddiy hisob, admin panelga kirish yo'q |

To'liq ruxsat matritsasi: `DATABASE_DOCUMENTATION.md` va
`supabase/migrations/0002_roles_permissions.sql` + `0021_phase2_roles_expansion.sql`.

### Ikki qatlamli enforcement

1. **Backend (haqiqiy, chetlab o'tib bo'lmaydigan):** har bir jadvalning
   Postgres RLS siyosati (`has_permission('...')`). Hatto kimdir frontend
   kodini butunlay chetlab o'tib to'g'ridan-to'g'ri Supabase API'ga so'rov
   yuborsa ham, ruxsatsiz amal bajarilmaydi.
2. **Middleware (yo'naltirish qulayligi uchun):** `middleware.ts`dagi
   `ROUTE_PERMISSIONS` — masalan `/admin/blog` uchun `posts.manage` kerak.
   Ruxsat yo'q bo'lsa, foydalanuvchi hatto sahifani ko'rmaydi (RLS xatolari
   to'la bo'sh sahifa ko'rsatish o'rniga to'g'ridan-to'g'ri
   `/admin/dashboard?error=forbidden`ga yo'naltiriladi).
3. **Frontend (UX qatlami):** `<Can permission="...">` komponenti va
   `usePermission()` hook'i — masalan admin panel navigatsiyasida
   foydalanuvchi kira olmaydigan bo'limlar umuman ko'rinmaydi. **Bu
   xavfsizlik chegarasi emas** — faqat interfeysni soddalashtirish;
   haqiqiy himoya doim 1-bandda.

### O'z-o'zini yuqoriga ko'tarishdan himoya

`/admin/users`da hech kim (super_admin ham) o'z qatoridagi rol
dropdown'ini o'zgartira olmaydi (UI darajasida disabled) — bazada esa
`prevent_self_role_escalation()` trigger (Phase 1) bu qoidani majburlaydi.

## 8. Uch tillilik (Uzbek / Русский / English)

`lib/i18n/dictionaries.ts` — barcha 3 tilda **to'liq** tarjima qilingan
(bo'sh yoki inglizchaga qaytadigan kalit yo'q) quyidagi qamrovda:

- Barcha auth oqimlari (login, forgot/reset password, email tasdiqlash,
  parolni o'zgartirish, parol kuchi xabarlari)
- 8 ta rol nomi
- Admin panel umumiy elementlari (chiqish, saqlash va h.k.)

Til tanlovi cookie'da (`partnerbet_locale`) saqlanadi, `LocaleSwitcher`
komponenti orqali istalgan sahifada (auth va admin) o'zgartiriladi.

**Ko'lam eslatmasi (halollik uchun):** Phase 0/1'dan qolgan mavjud admin
CRUD sahifalari (Blog, Insights, APK, Ads formalari) hali to'liq 3 tilga
tarjima qilinmagan — ular o'zbekcha matn bilan qoladi. Bu ataylab qilingan
qaror: auth tizimi (bu bosqichning asosiy maqsadi) 100% uch tilli, lekin
qolgan CMS UI'sini to'liq tarjima qilish alohida, maxsus i18n
bosqichi/so'rovi sifatida qilingani ma'qul — shoshilinch qilingan qisman
tarjima xato va nomuvofiqlikka olib kelishi mumkin edi.

## 9. Yangi ma'lumotlar bazasi o'zgarishlari (migratsiyalar)

| Fayl | Vazifasi |
|---|---|
| `0021_phase2_roles_expansion.sql` | 4 yangi rol (moderator, support, affiliate_manager, content_manager) |
| `0022_login_attempts.sql` | Brute-force kuzatuv jadvali |
| `0023_profiles_locale.sql` | Foydalanuvchi tili afzalligi ustuni |

## 10. API Route'lar

| Route | Vazifasi | Himoya |
|---|---|---|
| `POST /api/auth/login` | Kirish | Rate limiting (email + IP) |
| `POST /api/auth/change-password` | Parolni o'zgartirish | Joriy parolni qayta tekshirish |

## 11. Kelajakdagi bosqichlarga qoldirilgan (ataylab)

- Ijtimoiy tarmoq orqali kirish (Google/Telegram) — so'ralmagan, qo'shilmadi.
- 2FA/TOTP — so'ralmagan, qo'shilmadi (agar kerak bo'lsa alohida so'rov
  sifatida qilinishi tavsiya etiladi).
- To'liq admin CRUD UI'sining 3 tilga tarjimasi — Phase 3 doirasida
  (yuqoridagi 8-band eslatmasi).
