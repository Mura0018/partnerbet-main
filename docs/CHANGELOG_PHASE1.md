# CHANGELOG — Phase 1 (Supabase Fundament)

## Qo'shildi

- **19 ta SQL migratsiya fayli** (`supabase/migrations/0001`–`0019`), tartib bilan ishlaydigan.
- **21 jadval**: `roles`, `permissions`, `role_permissions`, `profiles`, `categories`, `tags`,
  `posts`, `post_tags`, `football_news`, `match_insights`, `promotions`, `apk_releases`,
  `advertisements`, `media`, `site_settings`, `navigation_items`, `faqs`,
  `support_conversations`, `support_messages`, `analytics_events`, `audit_logs`.
- **To'liq RBAC**: 4 rol (`super_admin`, `admin`, `editor`, `user`), 15 granular ruxsat,
  `has_permission()` SQL funksiyasi orqali har bir RLS siyosatida ishlatiladi.
- **Avtomatik audit log**: sezgir 11 jadvalning har bir INSERT/UPDATE/DELETE'i
  `audit_logs`ga `SECURITY DEFINER` trigger orqali yoziladi — dastur kodiga bog'liq emas.
- **Soft delete**: kontent jadvallarida `deleted_at`, hech qanday `DELETE FROM` yo'q
  (audit tarixi yo'qolmaydi).
- **Millionlab qatorga tayyorgarlik**: BRIN indekslar (`analytics_events`, `audit_logs`),
  qisman indekslar (`posts`, `apk_releases`), `pg_trgm` qidiruv indeksi.
- **DB darajasida qoidalar**: `apk_releases`da bir vaqtda faqat 1 ta faol versiya
  (unique partial index) — ilgari faqat ilova kodida, ishonchsiz tarzda amalga oshirilgan edi.
- **2 Storage bucket**: `media` (20MB limit), `apk` (200MB limit) — RLS bilan himoyalangan.
- **Self-elevation himoyasi**: oddiy foydalanuvchi o'z rolini o'zi ko'tara olmaydi
  (`prevent_self_role_escalation` trigger).
- Yangi hujjatlar: `ER_DIAGRAM.md`, `DATABASE_DOCUMENTATION.md`, ushbu `CHANGELOG.md`.

## O'zgartirildi (nomlar)

| Eski jadval | Yangi jadval |
|---|---|
| `admin_profiles` | `profiles` (endi barcha foydalanuvchilar uchun, rol FK bilan) |
| `insights` | `match_insights` |
| `blog_posts` | `posts` (endi `category_id` FK va to'liq `status` state machine bilan) |
| `ads` | `advertisements` (banner funksiyasi ham shu yerga birlashtirildi) |

## Ilova kodida yangilangan fayllar

- `middleware.ts` — endi `is_admin_user()` RPC orqali haqiqiy admin ruxsatini tekshiradi
  (avvalgi versiya faqat profil mavjudligini tekshirardi — `profiles` endi oddiy
  foydalanuvchilarni ham qamrab olgani uchun bu farq muhim).
- `app/page.tsx`, `app/admin/insights/page.tsx` — `insights` → `match_insights`.
- `app/admin/blog/page.tsx` — to'liq qayta yozildi: `posts` jadvali, `category_id`
  dropdown (+ tezkor "yangi kategoriya qo'shish"), `published` checkbox o'rniga
  `status` (draft/scheduled/published/archived) tanlovi.
- `app/admin/apk/page.tsx` — soft delete, `deleted_at is null` filtri.
- `app/admin/ads/page.tsx` — to'liq qayta yozildi: `advertisements` jadvali,
  `type`→`kind`, yagona `content` maydoni o'rniga `image_url`/`embed_code`.
- `app/admin/login/page.tsx` — yordam matni yangi rol tizimiga moslashtirildi.
- `README.md` — Super Admin yaratish qadamlari yangi RBAC oqimiga yangilandi.

## Tekshiruv

- Barcha `.ts`/`.tsx` fayllar haqiqiy `tsc --strict` kompilyatori bilan qayta tekshirildi
  (internet yo'qligi sababli to'liq `next build` emas — Vercel'ga birinchi deploy
  paytida yakuniy tasdiqlanadi). Faqat kutilgan ikkita soxta xato qoldi
  (`next.revalidate` — Next.js paketi o'rnatilmagani uchun; haqiqiy loyihada yo'qoladi).
- SQL fayllar qo'lda, qator-baqator FK/trigger/RLS bog'liqlik tartibiga solishtirib
  tekshirildi (mahalliy Postgres yo'qligi sababli avtomatik ishga tushirib bo'lmadi).

## Keyingi qadam

**Phase 2 — Auth + Rollar (UI)**: Login/Register/Forgot-Reset password, Email
tasdiqlash, Session boshqaruvi, va admin dashboard'da rol tanlash/almashtirish UI'i.
