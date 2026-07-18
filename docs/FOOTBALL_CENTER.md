# FOOTBALL_CENTER.md — Phase 3c: Provider-Agnostic Football Center

## Asosiy tamoyil: hech qanday provayder qattiq yozilmagan

Ilova kodining hech bir joyida "API-Football" yoki boshqa provayder nomi
biznes-mantiqqa yozilmagan. Bor-yo'g'i **3 ta joyda** provayder nomi
uchraydi: (1) `lib/football/providers/` — har bir provayder uchun bitta
moslashtiruvchi fayl, (2) `lib/football/registry.ts` — qaysi provayder
qanday kalit ishlatishini bog'lovchi jadval, (3) admin UI'dagi tanlov
ro'yxati. Boshqa hamma narsa — API route'lar, Football Center sahifasi,
admin panel — faqat **`FootballProvider`** interfeysi bilan ishlaydi.

## Arxitektura

```
┌─────────────────────┐
│  FootballProvider    │  ← umumiy interfeys (lib/football/types.ts)
│  interfeysi          │     getLiveFixtures(), getStandings(), ...
└──────────┬───────────┘
           │ implements
   ┌───────┼────────────┬──────────────────┐
   ▼                    ▼                  ▼
ApiFootball         Sportmonks      FootballDataOrg      ← kelajakda: +1 fayl
Provider             Provider         Provider
   │                    │                  │
   └────────────────────┴──────────────────┘
                         │
              lib/football/registry.ts
        (site_settings.football_provider.active
         + api_credentials'dan kalitni bog'laydi)
                         │
              lib/football/cache.ts
        (keshlash + provayder ishlamay qolsa
         eski ma'lumotni ko'rsatish)
                         │
              app/api/football/* route'lari
                         │
              app/football/page.tsx (ochiq sahifa)
```

## Yangi provayder qo'shish — kelajakda kod qayta yozilmaydi

1. `lib/football/providers/yangiProvider.ts` — `FootballProvider`
   interfeysini implement qiluvchi yangi klass.
2. `lib/football/registry.ts`dagi `PROVIDER_REGISTRY`ga bitta qator
   qo'shish.
3. Admin panel — Sozlamalar > API kalitlar bo'limidagi tanlov ro'yxatiga
   bitta `<option>` qo'shish.

**Hammasi shu.** Route'lar, keshlash, Football Center sahifasi — hech
biri o'zgarmaydi, chunki ular hech qachon provayderning xom
formatini ko'rmaydi — faqat normallashtirilgan (`NormalizedFixture`,
`NormalizedStandingRow`, `NormalizedTopScorer`) tipni.

## Xavfsiz kalit saqlash (Phase 3a infratuzilmasidan foydalaniladi)

Har bir provayder kaliti (`football_api_key`, `sportmonks_api_key`,
`footballdata_org_api_key`) `api_credentials` jadvalida — bu jadval
**hech qachon** brauzerga ochilmaydi (RLS siyosati yo'q, faqat
service-role). Admin panelda kalit kiritilgach, qayta ko'rsatilmaydi —
faqat "sozlangan" holati. Bu Phase 3a'da qurilgan naqsh, endi Football
Center ham shu orqali ishlaydi — **ikkinchi, alohida xavfsizlik tizimi
yaratilmadi.**

Qaysi provayder **faol** ekanligi (`football_provider.active`) — bu
maxfiy emas, oddiy `site_settings`da (chunki bu shunchaki tanlov, kalit
emas).

## Muvaffaqiyatsizlikka chidamlilik (graceful degradation)

Uch bosqichli himoya, hech qachon xato sahifasi yoki qulash bo'lmaydi:

1. **Provayder tanlanmagan yoki kalit kiritilmagan** →
   `getActiveFootballProvider()` `null` qaytaradi (xato tashlamaydi) →
   API route `{configured: false}` qaytaradi → Football Center
   professional "Hozircha jonli ma'lumot mavjud emas" holatini ko'rsatadi.
2. **Provayder vaqtincha ishlamay qoldi / limitga yetdi** →
   `withFootballCache()` avval eski (stale) keshni tekshiradi — agar
   mavjud bo'lsa, **shuni** qaytaradi (foydalanuvchi buni sezmaydi ham).
3. **Hech qanday kesh ham yo'q (birinchi so'rov, provayder ham
   ishlamayapti)** → bo'sh massiv qaytariladi, sahifa baribir normal
   render bo'ladi, faqat tegishli bo'lim bo'sh holatni ko'rsatadi.

## Kelajakda avtomatik failover (asos allaqachon tayyor)

Hozir: admin bitta "faol" provayderni tanlaydi. Agar kelajakda "birinchi
provayder ishlamasa, ikkinchisiga avtomatik o'tish" kerak bo'lsa —
`registry.ts`ga faqat **ro'yxat** (bitta emas) qaytaradigan funksiya
qo'shiladi, `cache.ts`dagi `withFootballCache()` esa fetcher
muvaffaqiyatsiz bo'lganda ro'yxatdagi keyingi provayderni sinab
ko'radigan qilib kengaytiriladi. Bu **qo'shimcha**, mavjud kodni
qayta yozishni talab qilmaydigan o'zgarish — aynan shu maqsadda
interfeys va registry alohida qilib loyihalandi.

## Football Center bo'limlari (`/football`)

| Bo'lim | Manba | Bo'sh holat |
|---|---|---|
| Live Matches | Provayder (jonli) | "Hozircha jonli o'yin yo'q" / "mavjud emas" |
| Featured Matches | `featured_fixtures` (admin belgilagan) + provayderdan jonli ma'lumot | Bo'lim umuman ko'rinmaydi (bo'sh bo'lsa) |
| League Tables | `featured_leagues` (admin tanlagan) + provayder | "Liga tanlanmagan" |
| Top Scorers | Provayder (tanlangan liga bo'yicha) | "Ma'lumot yo'q" |
| Football News | `football_news` (Phase 1 jadvali, qayta ishlatildi) | "Hozircha yangilik yo'q" |
| Videos | `football_videos` (yangi, tahririyat kontenti) | "Hozircha video yo'q" |

## Admin boshqaruvi

- **Provayder tanlash + kalitlar**: Sozlamalar > API kalitlar (Phase 3a
  bilan bitta joyda — ikkiga bo'linmagan).
- **Featured Leagues / Featured Matches / Videos**: yangi
  `/admin/football` (`football.manage` ruxsati bilan himoyalangan — yangi
  ruxsat, `super_admin`/`admin`/`content_manager` rollariga avtomatik
  biriktirildi).

## Yangi/o'zgargan fayllar

| Fayl | Vazifasi |
|---|---|
| `lib/football/types.ts` | `FootballProvider` interfeysi + normallashtirilgan tiplar |
| `lib/football/providers/*.ts` | 3 ta provayder moslashtiruvchisi |
| `lib/football/registry.ts` | Faol provayderni tanlash/yaratish |
| `lib/football/cache.ts` | Keshlash + muvaffaqiyatsizlikka chidamlilik |
| `app/api/football/fixtures/`, `standings/`, `topscorers/`, `fixture/[id]/` | Provayderga bog'liq bo'lmagan API route'lar (eskilari qayta yozildi) |
| `app/football/page.tsx` | Ochiq Football Center sahifasi |
| `app/admin/football/page.tsx` | Featured Leagues / Matches / Videos boshqaruvi |
| `app/admin/settings/page.tsx` | API kalitlar bo'limi provayder tanlovi bilan kengaytirildi |
| `supabase/migrations/0026_football_center.sql` | To'liq sxema |

## Muhim eslatma: tashqi API'larning aniq shakli

Sportmonks va Football-Data.org moslashtiruvchilari ularning hujjatlashgan
struktura asosida yozilgan, lekin tarmoq kirishi bo'lmagani sababli
haqiqiy so'rov bilan sinab ko'rilmadi (API-Football esa Phase 0/1'dan
beri ishlatilib kelingan, ancha ishonchli tekshirilgan). Production'ga
chiqarishdan oldin har bir tanlangan provayder bilan **kamida bitta
haqiqiy so'rovni** tekshirib ko'rish tavsiya etiladi — agar maydon
nomlari farq qilsa, faqat tegishli `providers/*.ts` faylidagi `map*()`
funksiyasini yangilash kifoya, boshqa hech narsa o'zgarmaydi.

## Tekshiruv

Barcha yangi/o'zgargan fayllar `tsc --strict` bilan tekshirildi. Qolgan
xatolar — avvalgi bosqichlardan tanish, `@types/react` o'rnatilmagan
tekshiruv muhiti sababli yuzaga keladigan soxta signal.
