# FRONTEND_DESIGN.md — Phase 5: Premium Frontend & UX

## Ko'lam

Bu bosqich **ochiq (public) sahifalar**ga bag'ishlangan — admin panel
Phase 5 ro'yxatida yo'q (u allaqachon Phase 0-4'da qurilgan ichki asbob).
"World-class user interface" talabi asl brend/marketing platformasiga
tegishli.

## 1. Original vizual o'ziga xoslik

**Hech qanday mavjud bukmeker brendidan nusxa olinmadi.** Rang tanlovi
ataylab quyidagicha farqlanadi:

| Element | Rang | Sabab |
|---|---|---|
| Fon (navy) | `#080C16` — deyarli qora, ko'k tusli | Chuqur, premium, "sport casino"dan farqli — texnologik/media platformaga o'xshaydi |
| Asosiy (accent) | `#3D7FFF` — zamonaviy ko'k | Havolalar, brend elementlari, UI harakatlari uchun |
| **CTA (yashil)** | `#17C964` | **Faqat** haqiqiy konversiya tugmalari uchun — pastga qarang |
| Oltin (vip) | `#FFB627` | **Faqat** reyting/featured belgilar uchun, hech qachon tugma emas |

### "Yashil faqat CTA uchun" qoidasi — qanday amalga oshirildi

`lib/ui/Button.tsx` — 4 variant: `cta` (yashil), `primary` (ko'k),
`outline`, `ghost`. Loyiha bo'ylab **faqat** quyidagi haqiqiy konversiya
harakatlari `cta` variantini ishlatadi:

- **Download App** — ilovani yuklab olish (`/apk`)
- **Claim Bonus** — bonus bo'limiga o'tish
- **Open Partner** — hamkor saytiga chiqish (`/go/{slug}`)

**"View Match" va "Read News" ataylab yashil emas** — bular ichki
navigatsiya (saytning o'z sahifasiga o'tish), pul ishlab topuvchi
konversiya emas. Agar ular ham yashil bo'lsa, yashil rangning "bu muhim
harakat" degan ma'nosi yo'qolar edi. Bu — dizayn tamoyilining ataylab,
mantiqiy talqini, e'tibordan chetda qolish emas.

## 2. Dizayn tizimi (`app/globals.css`, `tailwind.config.ts`)

- Barcha ranglar CSS o'zgaruvchilar orqali (Phase 3a'dan meros) — admin
  Sozlamalar'da ranglarni o'zgartirsa, **butun sayt darhol** yangilanadi.
- `.glass` — glassmorphism (header uchun, tanlab ishlatilgan — hamma
  joyda emas, faqat sticky header va modal kabi "suzuvchi" elementlarda).
- `.card-premium` — nozik border + hover'da yengil ko'tarilish animatsiyasi.
- `.animate-fade-in-up`, `.animate-fade-in`, `.stagger-item` — sahifa va
  ro'yxat elementlari uchun silliq kirish animatsiyasi.
- `.animate-shimmer`, `.animate-pulse-dot` — yuklanish/jonli holat
  indikatorlari uchun.

## 3. Umumiy komponentlar (`lib/ui/`) — dublikat kodni yo'qotish

Ilgari har bir ochiq sahifa o'zining header/footer/badge/card markup'ini
alohida yozardi (Phase 0-4 davomida tabiiy ravishda to'plangan dublikat).
Endi:

| Komponent | Vazifasi |
|---|---|
| `PublicHeader` | Barcha ochiq sahifalarda bitta header (logotip, navigatsiya, mobil menyu, bildirishnoma qo'ng'irog'i) |
| `PublicFooter` | Barcha ochiq sahifalarda bitta footer |
| `Button` | 4 variant, href yoki onClick bilan ishlaydi |
| `Card`, `Container`, `SectionHeading`, `Badge`, `EmptyState` | Umumiy qurilish bloklari |
| `PromoCodeButton` | Nusxalash + kuzatuv (hamkor sahifalarida qayta ishlatiladi) |

**Bosh sahifa (`app/page.tsx`) o'z header/footer'ini saqlab qoldi** —
chunki uning ichki bo'limlarga scroll qiluvchi navigatsiyasi bor
(Insights/Live Scores kabi), bu boshqa sahifalarda yo'q, umumiy
`PublicHeader`ga kiritish noto'g'ri bo'lardi. Bu ataylab qilingan
arxitektura qarori, nomuvofiqlik emas — rang/uslub esa bir xil dizayn
tizimidan foydalanadi.

## 4. Yangi sahifalar (ilgari mavjud bo'lmagan)

| Sahifa | Nima uchun yangi |
|---|---|
| `/apk` | Bosh sahifadagi APK bo'limi Phase 0'dan beri "Tez orada" bo'lib turardi — endi haqiqiy faol versiyani ko'rsatadi, **Download App** tugmasi ishlaydi |
| `/contact` | Ilgari faqat footer'da shartli mailto havolasi bo'lgan, endi to'liq sahifa |
| `/partners` | Barcha hamkorlar ro'yxati — ilgari faqat bosh sahifada qisqa promo-ro'yxat bor edi |
| `/partners/{slug}` | Har bir hamkor uchun to'liq sahifa: tavsif, bonus, promo-kodlar, reyting, **Open Partner** |
| `/football/league/{id}` | To'liq turnir jadvali + Top Scorers (ilgari faqat bosh sahifadagi tanlovda qisqa ko'rinish bor edi) |
| `/football/team/{id}` | Jamoa sahifasi — so'nggi o'yinlar (provider interfeysiga `getTeamFixtures()` qo'shildi, barcha 3 provayderda) |

## 5. Har bir CTA turi qayerda ishlatiladi

| CTA | Joylashuvi |
|---|---|
| **Download App** | Bosh sahifa hero, APK bo'limi, `/apk` sahifasi, footer |
| **Claim Bonus** | Bosh sahifa hero |
| **Open Partner** | Header, promo kartalari, `/partners`, `/partners/{slug}` |
| **View Match** | Football Center'dagi featured/live o'yin kartalari (jamoa nomi bosilganda `/football/team/{id}`ga o'tadi) |
| **Read News** | Blog ro'yxati kartalarida aniq yorliq sifatida |

## 6. Responsive va accessibility

- **Mobile-first**: barcha yangi sahifalar `grid md:grid-cols-*` naqshi
  bilan — standart holat mobil, `md:`/`lg:` breakpoint'larda kengayadi.
- **Mobil menyu**: `PublicHeader`da hamburger tugma, silliq ochilish
  animatsiyasi bilan.
- Tugmalar va havolalarda `aria-label` (ikonka-only tugmalarda),
  fokus holatlari brauzer standart uslubida saqlangan (maxsus
  o'chirilmagan).
- Rasm elementlarida `alt` atributlari majburiy qo'yilgan.

## 7. SEO-friendly HTML strukturasi

- Barcha yangi kontent sahifalari (`/blog/{slug}`, `/football/news/{slug}`,
  `/partners/{slug}`, `/football/league/{id}`, `/football/team/{id}`)
  **Server Component** — to'liq server-side render, `generateMetadata()`
  orqali haqiqiy meta teglar (Phase 3d naqshi davom ettirildi).
- Semantik HTML: `<article>`, `<header>`, `<footer>`, `<h1>`/`<h2>`
  ierarxiyasi har bir sahifada to'g'ri.

## 8. Ko'lam chegaralari (ataylab, halol)

- **"Statistics" sahifasi** alohida qurilmadi — Top Scorers (Football
  Center va Liga sahifalarida) va turnir jadvali mavjud statistikani
  qamrab oladi. Har bir o'yin bo'yicha batafsil statistika (pas
  aniqligi, zarbalar soni va h.k.) provayder API'sida qo'shimcha
  endpoint talab qiladi — hozircha qo'shilmadi, kelajakda `FootballProvider`
  interfeysiga yangi metod sifatida qo'shish mumkin (arxitektura tayyor).
- **Component-darajasidagi to'liq deduplikatsiya** (masalan
  `app/football/page.tsx`dagi mahalliy `EmptyState`) hammasi umumiy
  `lib/ui/`ga o'tkazilmadi — vizual natija bir xil dizayn tokenlaridan
  foydalanadi, lekin ba'zi eski sahifalarda kichik, past xavfli
  dublikat komponentlar qoldi. Bu bosqichning ko'lami va vaqt
  chegarasida oqilona murosaga misol — funksional emas, faqat kod
  tashkiloti darajasidagi kelishuv.

## Tekshiruv

Barcha yangi/o'zgargan fayllar `tsc --strict` bilan tekshirildi. Bu
bosqichda ma'lumotlar bazasiga hech qanday o'zgarish kiritilmadi (sof
frontend bosqichi). Qolgan xatolar — avvalgi bosqichlardan tanish,
muhit-sabab soxta signal (`key` prop).
