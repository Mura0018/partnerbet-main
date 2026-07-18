# CHANGELOG — Phase 5 (Premium Frontend & UX)

## Qo'shildi

### Dizayn tizimi
- `app/globals.css` — to'liq qayta ishlandi: yangi rang tokenlari
  (chuqurroq navy, yangi ko'k, **yangi ajratilgan yashil `cta` rang**),
  glassmorphism (`.glass`), premium karta hover animatsiyasi
  (`.card-premium`), kirish animatsiyalari (`fade-in-up`, `stagger-item`,
  `shimmer`, `pulse-dot`).
- `tailwind.config.ts` — `cta`, `bg-elevated`, `danger` ranglari qo'shildi.
- `lib/ui/` — yangi umumiy komponentlar kutubxonasi: `Button` (4 variant:
  cta/primary/outline/ghost), `Card`, `Container`, `SectionHeading`,
  `Badge`, `EmptyState`, `PublicHeader`, `PublicFooter`, `PromoCodeButton`.

### Yangi sahifalar
- `/apk` — **birinchi marta** haqiqiy faol APK versiyani ko'rsatadi va
  ishlaydigan Download tugmasi (ilgari Phase 0'dan beri "Tez orada" edi).
- `/contact` — aloqa ma'lumotlari sahifasi.
- `/partners` — barcha hamkorlar ro'yxati.
- `/partners/{slug}` — hamkor detali (bonus, promo-kodlar, reyting, Open Partner).
- `/football/league/{id}` — to'liq turnir jadvali + Top Scorers.
- `/football/team/{id}` — jamoa sahifasi, so'nggi o'yinlar.

### Provider kengaytmasi
- `FootballProvider` interfeysiga `getTeamFixtures()` qo'shildi, barcha
  3 provayderda (API-Football, Sportmonks, Football-Data.org) implement
  qilindi — Team Pages uchun.

## O'zgartirildi

- `app/page.tsx` — header/footer yangi dizayn tokenlariga o'tkazildi;
  "Claim Bonus"/"Open Partner"/"Download App" tugmalari yangi **yashil
  CTA** rangiga o'tkazildi; APK bo'limi endi `/apk`ga ulanadi (placeholder
  emas); navigatsiyaga Partners/App havolalari qo'shildi.
- `app/football/page.tsx` — umumiy `PublicHeader`/`PublicFooter`;
  turnir jadvalidagi jamoa nomlari `/football/team/{id}`ga ulanadi;
  "To'liq jadvalni ko'rish" havolasi `/football/league/{id}`ga.
- `app/blog/page.tsx`, `app/blog/[slug]/page.tsx`,
  `app/football/news/[slug]/page.tsx` — umumiy header/footer, "Read
  News →" aniq CTA yorlig'i qo'shildi, premium karta animatsiyalari.
- `app/error.tsx`, `app/not-found.tsx`, `app/maintenance/page.tsx`,
  `lib/auth/AuthShell.tsx` — eski rang qiymatlari yangi accent rangiga
  moslashtirildi (vizual nomuvofiqlikni tuzatish).

## Dizayn qarori: "Yashil faqat CTA uchun"

Yashil (`cta` rangi) faqat haqiqiy konversiya harakatlarida ishlatiladi:
**Download App**, **Claim Bonus**, **Open Partner**. "View Match" va
"Read News" ataylab yashil emas — bular ichki navigatsiya, konversiya
emas; ularni ham yashil qilish rangning ma'nosini yo'qotardi. Sabab va
har bir CTA turining aniq joylashuvi `FRONTEND_DESIGN.md`da.

## Ko'lam chegaralari (ataylab, hujjatlashtirilgan)

- Alohida "Statistics" sahifasi qurilmadi — Top Scorers va turnir jadvali
  mavjud ma'lumotni qamrab oladi; batafsil o'yin statistikasi kelajakda
  provider interfeysiga yangi metod sifatida qo'shilishi mumkin.
- Ba'zi eski sahifalarda (`app/football/page.tsx`) kichik, past xavfli
  mahalliy komponentlar (`EmptyState`) umumiy kutubxonaga to'liq
  ko'chirilmadi — vizual natija bir xil, faqat kod tashkiloti darajasida.

## Tekshiruv

Barcha yangi/o'zgargan fayllar `tsc --strict` bilan tekshirildi. Bu
bosqichda ma'lumotlar bazasiga o'zgarish kiritilmadi. Qolgan xatolar —
avvalgi bosqichlardan tanish muhit-sabab soxta signal.

## Keyingi qadam

Asl reja bo'yicha navbatdagi bosqichlar: **Phase 6 — Footer huquqiy
sahifalar** (About, Privacy, Terms, FAQ, Cookie Policy, Responsible
Gaming, DMCA va h.k.) yoki boshqa ustuvorlik.
