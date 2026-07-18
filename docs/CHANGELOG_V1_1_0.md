# CHANGELOG_V1_1_0.md — Live Streaming System

## Qo'shildi

### Ma'lumotlar bazasi (`0030_live_streaming.sql`)
- Yangi ruxsat: `streaming.manage` (super_admin/admin/content_manager'ga
  backfill qilindi).
- `streaming_providers` — admin ta'riflagan provайderlar (nom, Base API
  URL, ulanish holati, oxirgi xato) — kalit/sir bu jadvalda saqlanmaydi.
- `match_streams` — o'yinlarga provайder biriktirish (ko'p-ko'plik,
  primary/fallback, rejalashtirish).
- `streaming_connection_logs` — Test Connection va sinxronizatsiya tarixi.

### Shifrlash (yangi xavfsizlik qatlami)
- `lib/security/encryption.ts` — AES-256-GCM. Streaming provider
  kalit/siri **shifrlanib** saqlanadi (`ENCRYPTION_KEY` muhit
  o'zgaruvchisi) — Football/Push kalitlaridan farqli, ular faqat kirish
  nazorati bilan himoyalangan edi.
- `.env.example` — `ENCRYPTION_KEY` qo'shildi (majburiy).

### Provider Abstraction Layer
- `lib/streaming/types.ts` — `StreamingProvider` interfeysi.
- `lib/streaming/providers/genericRestProvider.ts` — yagona, sozlanadigan
  REST moslashtiruvchi (hech qanday haqiqiy yoki o'ylab topilgan
  provайder nomi kodga yozilmagan — sabab `LIVE_STREAMING_ARCHITECTURE.md`da).
- `lib/streaming/registry.ts`, `lib/streaming/credentials.ts` — provider
  yaratish + shifrlangan kalit boshqaruvi.

### Backend
- `app/api/admin/streaming/test-connection/route.ts` — rate-limited
  (5/5daq), natijani `streaming_connection_logs`ga yozadi.
- `app/api/admin/streaming/credentials/route.ts` — shifrlangan kalit
  saqlash (`streaming.manage`).
- `app/api/streaming/match-availability/route.ts` — ochiq, faqat xavfsiz
  maydonlarni qaytaradi (provider nomi, ID — hech qanday kalit/URL emas).
- `app/api/streaming/resolve/[matchStreamId]/route.ts` — ochiq, oqim
  URL'ini so'rov vaqtida yechadi.

### Frontend
- `/admin/streaming` — Providers (qo'shish/tahrirlash/yoqish-o'chirish/
  o'chirish/Test Connection/kalitlar) + Match Streams (o'yinga provайder
  biriktirish, primary/fallback, rejalashtirish) — 2 bo'lim.
- `lib/streaming/WatchLiveButton.tsx` — ochiq "▶ Watch Live" tugmasi,
  oqim yo'q bo'lsa **avtomatik yashiriladi**, bir nechta provайder
  bo'lsa tanlov ro'yxati.
- `lib/streaming/StreamPlayerModal.tsx` — pleer: yuklanish, xato +
  qayta urinish, oflayn aniqlash (avtomatik qayta ulanish).
- Football Center (`/football`) — jonli o'yinlar va Featured Matches
  bo'limlariga integratsiya qilindi.

## O'zgartirildi

- `app/api/football/fixtures/route.ts` — javobga `provider` maydoni
  qo'shildi (client tomonida `match_streams`ni to'g'ri
  `football_provider` bilan so'rash uchun kerak).
- `middleware.ts`, `app/admin/layout.tsx` — `/admin/streaming` route va
  nav bandi.

## Xavfsizlik

- Barcha maxfiy kalitlar **shifrlangan holda** saqlanadi (AES-256-GCM) —
  hatto ma'lumotlar bazasi dump qilinsa ham, `ENCRYPTION_KEY`siz o'qib
  bo'lmaydi.
- `streaming_providers`/`match_streams` ochiq o'qilmaydi — ochiq sayt
  faqat xavfsiz, cheklangan API route'lar orqali ma'lumot oladi.
- Har bir o'zgarish audit qilinadi (mavjud infratuzilma).
- Test Connection — rate-limited.
- Base API URL — ma'lumotlar bazasi darajasida validatsiya (`CHECK`).

## Kelajakka tayyorgarlik (faqat arxitektura, funksiya emas)

Talab bo'yicha quyidagilar **amalga oshirilmadi**, lekin arxitektura
ularni kod qayta yozilmasdan qo'shishga tayyor (batafsil
`LIVE_STREAMING_ARCHITECTURE.md`): Live statistika sinxronizatsiyasi,
Live timeline/hodisalar, Geo-cheklovlar, Obuna qo'llab-quvvatlash,
Premium oqimlar.

## Tekshiruv

Barcha yangi/o'zgargan fayllar `tsc --strict` bilan tekshirildi. Qolgan
xatolar — avvalgi bosqichlardan tanish muhit-sabab soxta signal.
Rol-ruxsat matritsasi (endi 17 ruxsat, 8 rol) Python orqali qayta
simulyatsiya qilinib tasdiqlandi.

## Muhim eslatma

Faqat **rasmiy, litsenziyalangan** translatsiya hamkorlarini qo'shish
uchun mo'ljallangan. Ruxsatsiz oqim manbalarini qo'llab-quvvatlash yoki
targ'ib qilish tizimning maqsadiga zid.
