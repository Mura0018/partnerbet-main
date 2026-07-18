# LIVE_STREAMING_ARCHITECTURE.md — Version 1.1.0

## Asosiy tamoyil: hech qanday oqim provayderi qattiq yozilmagan

Bu tizim Football Data provider abstraktsiyasiga (Phase 3c) o'xshaydi,
lekin **muhim farq bilan**: Football uchun 3 ta **haqiqiy, hujjatlashtirilgan**
API (API-Football, Sportmonks, Football-Data.org) mavjud edi va men
ularning har biriga moslashtiruvchi yozdim. Rasmiy sport translatsiya
(streaming) sohasida esa bunday umumiy, ochiq hujjatlashtirilgan
"standart API" yo'q — har bir litsenziyalangan translatsiya hamkori
o'zining maxsus (odatda maxfiy, shartnoma asosidagi) API'siga ega.

Shuning uchun bu yerda **haqiqiy yoki o'ylab topilgan provayder nomi
umuman kodga yozilmagan**. Buning o'rniga:

1. Provayderlar **to'liq admin panel orqali** ta'riflanadi (nom, Base API
   URL, kalit/sir) — ma'lumotlar bazasida, kodda emas.
2. Bitta **umumiy, sozlanadigan REST moslashtiruvchi**
   (`GenericRestStreamingProvider`) barcha admin yaratgan provayderlar
   uchun ishlaydi, aniq, hujjatlashtirilgan standart shartnoma asosida
   (pastga qarang).
3. Agar kelajakda haqiqiy hamkorning API'si bu standart shartnomaga mos
   kelmasa — **faqat shu bitta hamkor uchun** yangi klass yoziladi
   (`lib/streaming/providers/` papkasiga), `StreamingProvider`
   interfeysini implement qilib. Boshqa hech qanday kod o'zgarmaydi —
   xuddi Football provider tizimidagi kabi.

## Arxitektura

```
┌──────────────────────┐
│  StreamingProvider    │  ← umumiy interfeys (lib/streaming/types.ts)
│  interfeysi           │     testConnection(), getStream(streamId)
└──────────┬────────────┘
           │ implements
           ▼
  GenericRestStreamingProvider   ← standart REST shartnoma bilan ishlaydigan
  (lib/streaming/providers/)        yagona, sozlanadigan implementatsiya
           │
  lib/streaming/registry.ts     ← bazadagi provider qatoridan + shifrlangan
                                    kalitdan instansiya yaratadi
           │
  lib/streaming/credentials.ts  ← AES-256-GCM shifrlash/deshifrlash
           │
  app/api/streaming/*           ← ochiq (public) va admin API route'lar
           │
  WatchLiveButton + StreamPlayerModal  ← ochiq UI
```

## Standart REST shartnoma (GenericRestStreamingProvider)

Bu — **standart, hujjatlashtirilgan taxmin**, aniq bir haqiqiy xizmatning
API'si emas:

```
GET {baseApiUrl}/status
  Headers: X-Api-Key, X-Api-Secret (agar kiritilgan bo'lsa)
  200 OK = ulangan

GET {baseApiUrl}/streams/{streamId}
  Headers: X-Api-Key, X-Api-Secret
  200 OK, javob: { "stream_url": "https://...", "status": "live" | "scheduled" | "ended" }
```

Agar haqiqiy hamkor shu shartnomaga mos API taqdim etsa (ko'p REST
xizmatlar shunga o'xshash), admin panelda uni qo'shish — kod yozmasdan,
faqat Base API URL + kalitlarni kiritish orqali ishlaydi.

## Ma'lumotlar modeli

- **`streaming_providers`** — admin ta'riflagan har bir provider (nom,
  Base API URL, ulanish holati, oxirgi sinxronizatsiya, oxirgi xato).
  Kalit/sir bu jadvalda **saqlanmaydi** — alohida, shifrlangan.
- **`match_streams`** — bitta o'yinga (aniqlanishi: `football_provider` +
  `external_fixture_id`, Football Center'dagi `featured_fixtures` bilan
  bir xil naqsh) bir yoki bir nechta streaming provider bog'lanadi.
  `is_primary` — asosiy, qolganlari **zaxira (fallback)**.
  `starts_at`/`ends_at` — rejalashtirish.
- **`streaming_connection_logs`** — "Test Connection" va sinxronizatsiya
  tarixi ("Error Logs" talabi).

## Xavfsizlik

### Shifrlash (yangi, football/push kalitlaridan farqli)

Football va Push kalitlari (Phase 3a/4) faqat **kirish nazorati** bilan
himoyalangan edi (RLS siyosati yo'q — faqat service-role). Streaming
kalitlari **qo'shimcha ravishda shifrlanadi** (`lib/security/encryption.ts`,
AES-256-GCM, `ENCRYPTION_KEY` muhit o'zgaruvchisi bilan) — hatto
ma'lumotlar bazasining o'zi ko'chirilsa ham (dump), `ENCRYPTION_KEY`siz
qiymatlar o'qib bo'lmaydi. Bu ikki mustaqil himoya qatlami: kirish
nazorati + shifrlash.

### RBAC

Yangi ruxsat: `streaming.manage` — `super_admin`, `admin`,
`content_manager` rollariga biriktirilgan (Football'dagi bilan bir xil
naqsh).

### Audit

`streaming_providers` va `match_streams` — har bir o'zgarish avtomatik
audit qilinadi (mavjud `audit_trigger()` infratuzilmasi).

### Rate Limiting

"Test Connection" tugmasi — bitta provider uchun 5 daqiqada 5 martadan
ko'p bosilsa, `429` qaytaradi (`/api/admin/streaming/test-connection`).

### Input validatsiyasi

Base API URL — `CHECK` constraint orqali `^https?://` formatini talab
qiladi (ma'lumotlar bazasi darajasida, chetlab o'tib bo'lmaydi).

## Ochiq (public) tomon xatti-harakati

- **Oqim mavjud bo'lsa**: "▶ Watch Live" tugmasi ko'rinadi.
- **Bir nechta rasmiy provider bo'lsa**: tugma bosilganda tanlov ro'yxati
  ochiladi (birinchi — `is_primary`).
- **Oqim yo'q bo'lsa**: tugma **avtomatik butunlay yashiriladi**
  (`WatchLiveButton` hech narsa render qilmaydi) — bo'sh yoki
  o'chirilgan tugma ko'rsatilmaydi.
- **Yuklanish/xato/oflayn holatlari**: `StreamPlayerModal` — yuklanish
  aylanasi, xato + "Qayta urinish" tugmasi, `navigator.onLine` orqali
  oflayn aniqlash va internet qaytganda avtomatik qayta urinish.

## Kelajakka tayyorgarlik (arxitektura darajasida, hozir amalga oshirilmagan)

Talab bo'yicha **faqat arxitektura tayyorlandi**, funksiya qo'shilmadi:

| Kelajakdagi funksiya | Qanday tayyor |
|---|---|
| Live statistika sinxronizatsiyasi | `streaming_connection_logs.event_type` allaqachon `'sync'`ni qo'llab-quvvatlaydi — kelajakda davriy sinxronizatsiya job'i shu jurnalga yozadi |
| Live timeline / hodisalar | `StreamInfo` tipi kengaytirilishi mumkin (`events?: TimelineEvent[]`) — interfeys buzilmaydi |
| Ko'p provider | Allaqachon to'liq ishlaydi (`match_streams` — ko'p-ko'plik) |
| Geo-cheklovlar | `match_streams`ga `allowed_countries text[]` ustuni qo'shish — mavjud `affiliate_partners.countries` naqshi bilan bir xil, kod o'zgarishi minimal |
| Obuna (subscription) qo'llab-quvvatlash | `profiles`da allaqachon `role_id` bor; kelajakda "subscriber" roli yoki alohida `subscriptions` jadvali qo'shilishi mumkin, `StreamingProvider` interfeysi o'zgarmaydi |
| Premium oqimlar | `match_streams`ga `requires_subscription boolean` ustuni — **ataylab hozir qo'shilmadi**, faqat osonlik uchun joy qoldirilgan |

## Yangi/o'zgargan fayllar

| Fayl | Vazifasi |
|---|---|
| `supabase/migrations/0030_live_streaming.sql` | To'liq sxema |
| `lib/security/encryption.ts` | AES-256-GCM shifrlash |
| `lib/streaming/types.ts` | `StreamingProvider` interfeysi |
| `lib/streaming/providers/genericRestProvider.ts` | Yagona, sozlanadigan moslashtiruvchi |
| `lib/streaming/registry.ts` | Provider yaratish |
| `lib/streaming/credentials.ts` | Shifrlangan kalit saqlash/o'qish |
| `app/api/admin/streaming/test-connection/route.ts` | Rate-limited ulanish tekshiruvi |
| `app/api/admin/streaming/credentials/route.ts` | Kalit boshqaruvi |
| `app/api/streaming/match-availability/route.ts` | Ochiq: mavjudlik tekshiruvi |
| `app/api/streaming/resolve/[matchStreamId]/route.ts` | Ochiq: oqim URL'ini yechish |
| `lib/streaming/WatchLiveButton.tsx` | Ochiq UI — tugma + tanlov |
| `lib/streaming/StreamPlayerModal.tsx` | Ochiq UI — pleer (yuklanish/xato/oflayn) |
| `app/admin/streaming/page.tsx` | Admin: Providers + Match Streams |

## Tekshiruv

Barcha yangi fayllar `tsc --strict` bilan tekshirildi. Qolgan xatolar —
avvalgi bosqichlardan tanish muhit-sabab soxta signal.
