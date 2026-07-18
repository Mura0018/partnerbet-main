# PERFORMANCE REPORT — Phase 1

## 1. Indekslash strategiyasi

29 ta indeks, barchasi haqiqiy so'rov naqshiga mos ravishda tanlangan (spekulyativ
emas):

| Naqsh | Qayerda ishlatilgan | Sabab |
|---|---|---|
| **Qisman (partial) indeks** `where deleted_at is null` | `posts`, `media`, `categories`, `match_insights`, `promotions`, `apk_releases`, `navigation_items`, `faqs` | Faqat "jonli" qatorlarni indekslaydi — o'chirilgan qatorlar hajmni oshirmaydi, so'rovlar tezroq |
| **Composite indeks** `(status, published_at desc)` | `posts`, `football_news` | Eng keng tarqalgan so'rov ("nashr etilgan, sanaga ko'ra tartiblangan") bitta indeks bilan qoplanadi |
| **BRIN indeks** | `analytics_events.created_at`, `audit_logs.created_at` | Vaqt bo'yicha tabiiy tartiblangan, doimiy o'sib boruvchi jadvallar uchun B-tree'ga qaraganda 10-100x kichikroq |
| **GIN + `pg_trgm`** | `posts.title` | Tezkor qisman-mos qidiruv (`ILIKE '%so'z%'`) — Phase 5 qidiruv funksiyasi uchun tayyorgarlik |
| **Noyob qisman indeks** | `apk_releases (is_active) where is_active=true` | "Faqat 1 faol versiya" qoidasini ma'lumotlar bazasi darajasida bepul kafolatlaydi — qo'shimcha so'rov kerak emas |

## 2. Millionlab qatorga chidamlilik tahlili

| Jadval | Kutilgan o'sish tezligi | Tayyorgarlik |
|---|---|---|
| `analytics_events` | Yuqori (har sahifa ko'rishda) | BRIN indeks + kelajakda oylik partition (`PARTITION BY RANGE (created_at)`) osonlik bilan qo'shiladi, struktura o'zgarishi shart emas |
| `audit_logs` | O'rta-yuqori (har admin amalida) | Xuddi shu BRIN strategiyasi |
| `posts`, `football_news` | Past-o'rta (qo'lda yaratiladi) | Composite indeks yetarli, minglab qatorgacha muammosiz |
| `match_insights` | O'rta (kunlik/haftalik) | `match_time` bo'yicha indeks, eskirgan yozuvlar arxivlanishi mumkin |

**Xulosa:** hech qanday jadval "million qatorda qulab tushadigan" dizaynga ega emas.
Eng ko'p o'sadigan ikkita jadval (`analytics_events`, `audit_logs`) allaqachon
partition-ga tayyor struktura bilan yaratilgan (vaqt-asosli, faqat qo'shiladigan,
UUID PK — partition qo'shish uchun qayta dizayn kerak emas).

## 3. RLS'ning ishlash tezligiga ta'siga baho

Har bir "public read" so'rovi RLS siyosatini bajaradi (masalan
`status='published' and deleted_at is null`). Bu ustunlar tegishli composite
indeksda qatnashgani uchun (`idx_posts_status_published`), Postgres RLS shartini
**indeks skanerlash bilan birlashtira oladi** — qo'shimcha sekinlik deyarli sezilmaydi.

Admin so'rovlari `has_permission()` funksiyasini chaqiradi — bu funksiya ichida
faqat bitta qator (`p.id = auth.uid()`) qidiriladi, natija juda tez (PK bo'yicha
qidiruv). `STABLE` deb belgilanganligi sababli Postgres bir so'rov ichida uni bir
necha marta qayta hisoblamaydi (caching).

## 4. Kelajakdagi optimallashtirish takliflari (hozir kerak emas, eslatma sifatida)

- `analytics_events`/`audit_logs` 5-10 million qatorga yetganda: oylik partition.
- `posts`/`football_news` matn qidiruvi murakkablashsa: `pg_trgm` o'rniga to'liq
  `tsvector` full-text search ustuniga o'tish (Phase 5 doirasida ko'rib chiqiladi).
- Media fayllar juda ko'payganda: `media` jadvaliga `folder_id`/albom tuzilmasi
  (hozir shart emas, YAGNI).
- Yuqori trafikda: Supabase connection pooling (PgBouncer, Supabase'da standart
  yoqilgan) — hech qanday qo'shimcha sozlash talab qilinmaydi.

## Yakuniy natija

Sxema hozirgi ko'lamda (minglab-o'n minglab qator) va o'rta muddatli o'sishda
(millionlab `analytics_events`/`audit_logs` qatori) qayta dizaynsiz ishlaydi.
Hech qanday darhol optimallashtirish talab qilinmaydi.
