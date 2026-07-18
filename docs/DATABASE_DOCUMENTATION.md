# PartnerBet Pro V2 — Database Documentation (Phase 1)

## 1. Arxitektura tamoyillari

- **Har bir jadval:** `id uuid primary key default gen_random_uuid()`.
- **Vaqt tamg'alari:** deyarli har bir jadvalda `created_at`, ko'pchiligida `updated_at`
  (avtomatik `set_updated_at()` trigger orqali yangilanadi).
- **Soft delete:** kontent jadvallarida (`posts`, `football_news`, `match_insights`,
  `promotions`, `apk_releases`, `advertisements`, `media`, `categories`, `navigation_items`,
  `faqs`) `deleted_at timestamptz` ustuni bor — o'chirish `update ... set deleted_at = now()`
  orqali, `delete from` orqali emas. Bu tasodifiy yo'qotishning oldini oladi va audit tarixini
  saqlab qoladi. Sof ma'lumot (`roles`, `permissions`, `tags`, `audit_logs`,
  `analytics_events`) soft delete talab qilmaydi.
- **Normalizatsiya:** kategoriyalar `content_type` ustuni orqali `posts` va `football_news`
  o'rtasida bitta jadvalda ishlatiladi (ikkita deyarli bir xil jadval yaratish o'rniga).
  Xuddi shunday, `advertisements` jadvali eski "ads" va rejadagi "banners"ni `kind`
  ustuni orqali birlashtiradi — dublikat jadval yo'q.

## 2. Rol asosidagi ruxsatlar (RBAC)

4 ta standart rol: `super_admin`, `admin`, `editor`, `user` (`roles` jadvalida).
15 ta granular ruxsat (`permissions`), masalan `posts.manage`, `apk.manage`,
`roles.manage`. `role_permissions` — ko'p-ko'pga bog'lovchi jadval.

Har bir yozib bo'ladigan jadvalning RLS siyosati quyidagi funksiyani chaqiradi:

```sql
has_permission('posts.manage')  -- joriy foydalanuvchining roli shu ruxsatga egami?
```

Yangi bo'lim qo'shilganda (masalan Phase 3'da "comments.manage") — faqat
`permissions` jadvaliga bitta qator qo'shiladi va tegishli rolga bog'lanadi,
kodni qayta yozish shart emas.

**Muhim xavfsizlik dizayni:** `has_permission()` ichkarida faqat
`where p.id = auth.uid()` — ya'ni har doim FAQAT o'zining profilini
so'raydi. Bu `profiles` jadvalidagi "o'z profilini o'qish" RLS siyosati bilan
mos keladi va cheksiz rekursiya (RLS siyosat ichida yana RLS chaqirish)
yuzaga kelishining oldini oladi.

**O'z-o'zini yuqoriga ko'tarish (self-elevation) himoyasi:** oddiy foydalanuvchi
o'z profilini yangilay oladi (masalan, ismini), lekin `role_id`ni o'zi
o'zgartira olmaydi — `prevent_self_role_escalation()` trigger buni majburiy
qaytaradi, `users.manage` huquqiga ega bo'lmasa.

## 3. Audit Logs (avtomatik)

`audit_trigger()` funksiyasi — `SECURITY DEFINER`, ya'ni oddiy admin/editor
hisobining o'zi yozish huquqi bo'lmasa ham, u orqali `audit_logs` jadvaliga
har bir INSERT/UPDATE/DELETE avtomatik yoziladi (dastur kodi buni "unutib
qo'yishi" mumkin emas — bu ma'lumotlar bazasi darajasida majburiy).
Yoziladigan jadvallar: `media`, `categories`, `posts`, `football_news`,
`match_insights`, `promotions`, `apk_releases`, `advertisements`,
`site_settings`, `navigation_items`, `faqs`.

`audit_logs`ni faqat `logs.view` huquqiga ega foydalanuvchi o'qiy oladi;
hech kim (super_admin ham) uni to'g'ridan-to'g'ri yoza yoki o'chira olmaydi.

## 4. Millionlab qatorlarga tayyorlik

- **BRIN indekslar** (`analytics_events.created_at`, `audit_logs.created_at`) —
  vaqt bo'yicha tartiblangan, doimiy o'sib boruvchi jadvallar uchun oddiy
  B-tree'ga qaraganda 10-100x kichikroq va tezroq.
- **Qisman (partial) indekslar** — masalan
  `idx_posts_status_published on posts(status, published_at desc) where deleted_at is null`
  — faqat "jonli" qatorlarni indekslaydi, o'chirilganlarni emas.
- **`idx_apk_releases_one_active`** — noyob qisman indeks orqali "faqat bitta
  faol versiya" qoidasi ma'lumotlar bazasi darajasida kafolatlanadi (ilgari
  faqat dastur kodida, poydor bo'lmagan holda amalga oshirilgan edi).
- **`pg_trgm` + GIN indeks** (`posts.title`) — tezkor qidiruv (Phase 5) uchun
  tayyorgarlik, `LIKE '%...%'` sekin so'rovlarsiz.
- Kelajakda 10+ million qatorga yetganda: `analytics_events` va `audit_logs`
  oy bo'yicha **partition qilinishi** mumkin (`PARTITION BY RANGE (created_at)`)
  — hozirgi struktura bunga to'sqinlik qilmaydi.

## 5. Storage Bucket'lar

| Bucket | Public | Limit | Ruxsat |
|---|---|---|---|
| `media` | ✅ | 20 MB/fayl | Yuklash/o'chirish — `media.manage` |
| `apk` | ✅ | 200 MB/fayl | Yuklash/o'chirish — `apk.manage` |

## 6. Eski sxemadan farqlar (Phase 0 → Phase 1)

| Eski | Yangi | Sabab |
|---|---|---|
| `admin_profiles` | `profiles` | Endi har qanday foydalanuvchi uchun (Phase 2 ochiq ro'yxatdan o'tish uchun tayyor), rol FK orqali |
| `insights` | `match_insights` | Aniqroq nom, boshqa modullar bilan mos naming convention |
| `blog_posts` | `posts` | `category` matn ustuni o'rniga `category_id` FK, `published boolean` o'rniga to'liq `status` state machine |
| `ads` | `advertisements` | Banner va reklama funksiyasini bitta jadvalga birlashtirdi (`kind` orqali) |
| — | `roles`, `permissions`, `role_permissions` | Yangi — to'liq RBAC |
| — | `categories`, `tags`, `post_tags` | Yangi — taksonomiya |
| — | `media` | Yangi — Media Library metadata |
| — | `site_settings`, `navigation_items`, `faqs` | Yangi — "kod yozmasdan" sayt boshqaruvi uchun fundament |
| — | `audit_logs` | Yangi — avtomatik audit tarixi |

## 7. Birinchi Super Admin yaratish

```sql
-- 1) Supabase Dashboard > Authentication > Users > Add user orqali hisob yarating.
--    (handle_new_user() trigger avtomatik "user" rolli profil yaratadi)
-- 2) SQL Editor'da shu hisobni super_admin qiling:
update profiles
set role_id = (select id from roles where key = 'super_admin')
where id = 'BU_YERGA_USER_UID';
```
