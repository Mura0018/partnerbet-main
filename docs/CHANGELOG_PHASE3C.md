# CHANGELOG — Phase 3c (Provider-Agnostic Football Center)

## Qo'shildi

### Ma'lumotlar bazasi (`0026_football_center.sql`)
- Yangi ruxsat: `football.manage` (super_admin/admin/content_manager'ga
  backfill qilindi — birinchi marta mavjud rollarga YANGI ruxsat qo'shish,
  batafsil izoh migratsiya faylida).
- `site_settings.football_provider` — faol provayder + standart liga/mavsum.
- `football_cache` — keshlash (server-only, ochiq emas).
- `featured_leagues`, `featured_fixtures` — admin tanlovlari (hech qanday
  provayder ID'si kodga yozilmagan).
- `football_videos` — tahririyat kontenti.

### Provider Abstraction Layer
- `lib/football/types.ts` — `FootballProvider` interfeysi, normallashtirilgan
  tiplar (`NormalizedFixture`, `NormalizedStandingRow`, `NormalizedTopScorer`).
- `lib/football/providers/apiFootball.ts`, `sportmonks.ts`, `footballDataOrg.ts`
  — 3 ta to'liq moslashtiruvchi.
- `lib/football/registry.ts` — provayder tanlash/yaratish, xavfsiz kalit
  bilan bog'lash.
- `lib/football/cache.ts` — keshlash + muvaffaqiyatsizlikka chidamlilik
  (provayder ishlamay qolsa, eski ma'lumot ko'rsatiladi).

### Backend
- `app/api/football/fixtures/`, `standings/`, `topscorers/` — **qayta
  yozildi**, endi to'liq provayderga bog'liq emas (avval to'g'ridan-to'g'ri
  API-Football'ga bog'langan edi).
- `app/api/football/fixture/[id]/` — yangi, Featured Matches uchun.

### Frontend
- `/football` — to'liq ochiq Football Center: Live Matches, Featured
  Matches, League Tables, Top Scorers, News, Videos — barchasida
  professional "ma'lumot yo'q" holati.
- `/admin/football` — Featured Leagues / Featured Matches / Videos
  boshqaruvi (`football.manage`).
- `/admin/settings` — API kalitlar bo'limi provayder tanlovi + standart
  liga/mavsum bilan kengaytirildi (ikkinchi, alohida sozlamalar sahifasi
  yaratilmadi).

## O'zgartirildi

- `middleware.ts` — `/admin/football` route tekshiruvi qo'shildi.
- `app/admin/layout.tsx` — "Football Center" nav bandi.
- `app/page.tsx` — "Standings" endi "tez orada" emas, haqiqiy `/football`ga
  ulanadi.
- `app/api/admin/secrets/route.ts` — yangi provayder kalitlari ro'yxatga
  qo'shildi.
- `.env.example`'da hech narsa o'zgarmadi — barcha yangi kalitlar admin
  paneldan kiritiladi (talab: "API keys must be editable only from the
  Admin panel").

## Xavfsizlik va arxitektura qarorlari

- Hech qanday provayder nomi biznes-mantiqqa yozilmagan — faqat 3 ta
  aniq joyda (moslashtiruvchi fayllar, registry, admin tanlov ro'yxati).
- Barcha kalitlar Phase 3a'ning xavfsiz `api_credentials` naqshi orqali —
  ikkinchi xavfsizlik tizimi qurilmadi.
- Provayder tanlanmagan/kalit yo'q holatda tizim **hech qachon qulamaydi**
  — har doim professional bo'sh holat ko'rsatiladi.

## Tekshiruv

Barcha yangi/o'zgargan fayllar `tsc --strict` bilan tekshirildi. Qolgan
xatolar — avvalgi bosqichlardan tanish muhit-sabab soxta signal.
Sportmonks/Football-Data.org moslashtiruvchilari tarmoq kirishi
yo'qligi sababli haqiqiy so'rov bilan sinalmadi — bu `FOOTBALL_CENTER.md`da
aniq belgilangan, production oldidan tekshirish tavsiya etiladi.

## Keyingi qadam

**Phase 3d — News CMS**: Categories, Tags, Rich Text Editor — mavjud Blog
tizimini (Phase 1) professional darajaga ko'taradi.
