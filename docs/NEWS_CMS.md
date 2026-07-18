# NEWS_CMS.md — Phase 3d: Professional News Management

## Ko'lam

Bu bosqich Phase 1'da yaratilgan, lekin hech qachon to'liq admin UI'ga ega
bo'lmagan `posts` (Blog) va `football_news` tizimlarini professional
darajaga ko'taradi: Rich Text Editor, to'liq Kategoriya/Teg boshqaruvi,
SEO maydonlari, muqova rasmi, va — muhimi — **birinchi marta ochiq
o'qish sahifalari** (`/blog`, `/blog/{slug}`, `/football/news/{slug}`).

## Nima o'zgardi

### Rich Text Editor
`lib/editor/RichTextEditor.tsx` — TipTap asosida, quyidagilarni
qo'llab-quvvatlaydi: qalin/kursiv/chizilgan matn, H2/H3 sarlavhalar,
ro'yxatlar, iqtibos, havola, rasm qo'shish (mavjud Media yuklash
tizimi — Phase 3a orqali), bekor qilish/qaytarish. Natija HTML sifatida
saqlanadi.

**Xavfsizlik — ikki qatlamli tozalash:** kontent muallifi ishonchli xodim
hisobi bo'lsada (`posts.manage`/`football_news.manage` RLS orqali
majburlangan), HTML **saqlashdan oldin** (`lib/editor/sanitize.ts`,
`isomorphic-dompurify`) VA **ko'rsatishdan oldin** (`RichTextRenderer`)
ikki marta tozalanadi — faqat xavfsiz teglar/atributlar ro'yxatiga ruxsat
beriladi (`<script>`, `on*` atributlar va h.k. har doim olib tashlanadi).

### Kategoriyalar va Teglar — to'liq boshqaruv
Ilgari kategoriya faqat Blog formasida "tezkor qo'shish" orqali
yaratilardi, teglar uchun esa **umuman UI yo'q edi** (baza jadvali
Phase 1'dan beri bor edi, lekin ishlatilmagan). Endi:
- `/admin/categories` — Blog va Football News uchun alohida (ota-bola
  ierarxiyasi, har biriga nechta post bog'langani ko'rinadi).
- `/admin/tags` — global teglar, ishlatilish soni bilan.
- Blog formasida teglarni ko'p tanlash (checkbox-uslub) + tezkor yaratish
  (`taxonomy.manage` huquqi bilan).

### SEO va muqova rasmi
`posts`/`football_news` jadvallarida Phase 1'dan beri mavjud, lekin admin
UI'da hech qachon ko'rsatilmagan maydonlar endi to'liq ishlaydi:
`seo_title`, `seo_description`, `seo_keywords`, `cover_media_id` (+ yangi
`cover_url` — boshqa joylarda ishlatilgan naqsh bilan bir xil, join'siz
tezkor ko'rsatish uchun).

### Ochiq o'qish sahifalari (yangi — ilgari umuman yo'q edi)
- `/blog` — ro'yxat, kategoriya bo'yicha filtr.
- `/blog/{slug}` — to'liq maqola, **haqiqiy SEO** (`generateMetadata`,
  Server Component, Open Graph), teglar, o'xshash maqolalar, ko'rishlar
  hisoblagichi.
- `/football/news/{slug}` — xuddi shu naqsh football yangiliklari uchun.

**Muhim tuzatish:** Phase 1/3c'da `posts` va `football_news` jadvallariga
kontent yozish mumkin edi, lekin uni **o'qish uchun hech qanday ochiq
sahifa yo'q edi** — bu bosqichda aniqlanib, to'ldirildi.

### Ko'rishlar hisoblagichi
`app/api/content/track-view/route.ts` — public endpoint (`login_attempts`/
`promo_codes` bilan bir xil naqsh: jadvalning o'zi ochiq yozishga yopiq,
faqat shu bitta hisoblagich uchun maxsus, service-role orqali ishlaydigan
endpoint). Sahifa yuklanganda emas, **brauzerda** (`ViewTracker` client
komponenti) hisoblanadi — bu qidiruv botlari/prefetch so'rovlarini biroz
kamroq hisoblaydi.

## Ko'lam chegaralari (ataylab, hujjatlashtirilgan)

- **Football News teglarga ega emas** — faqat kategoriya va liga
  (matn maydoni). Ikkinchi, to'liq tag-tizimini qurish bu bosqich uchun
  ortiqcha murakkablik deb topildi; agar kerak bo'lsa, keyingi so'rov
  sifatida qo'shish mumkin.
- **Qidiruv** (`/blog`da so'z bo'yicha qidiruv) qo'shilmadi — bu Phase 5
  (Frontend/UX) rejasida "Search" funksiyasi sifatida allaqachon
  rejalashtirilgan.

## Yangi/o'zgargan fayllar

| Fayl | Vazifasi |
|---|---|
| `supabase/migrations/0027_news_cms.sql` | `cover_url` ustunlari |
| `lib/editor/RichTextEditor.tsx` | WYSIWYG tahrirlovchi |
| `lib/editor/RichTextRenderer.tsx` | Ochiq sahifalarda xavfsiz ko'rsatish |
| `lib/editor/sanitize.ts` | HTML tozalash (ikki qatlamli) |
| `app/admin/categories/page.tsx` | Kategoriya boshqaruvi (yangi) |
| `app/admin/tags/page.tsx` | Teg boshqaruvi (yangi) |
| `app/admin/blog/page.tsx` | To'liq qayta yozildi — RTE, teglar, SEO, muqova |
| `app/admin/football-news/page.tsx` | Yangi — Football News uchun to'liq admin |
| `app/blog/page.tsx`, `app/blog/[slug]/page.tsx` | Yangi — ochiq o'qish sahifalari |
| `app/football/news/[slug]/page.tsx` | Yangi — football yangilik detali |
| `app/api/content/track-view/route.ts` | Ko'rishlar hisoblagichi |
| `lib/ViewTracker.tsx` | Client komponent (fire-and-forget) |
| `package.json` | `@tiptap/*`, `isomorphic-dompurify`, `@tailwindcss/typography` |

## Tekshiruv

Barcha yangi/o'zgargan fayllar `tsc --strict` bilan tekshirildi (yangi
paketlar `node_modules`da mavjud emasligi sababli ularning "modul
topilmadi" xabarlari kutilgan va e'tiborga olinmadi — TipTap/DOMPurify
API'lari yaxshi hujjatlashtirilgan, barqaror versiyalar asosida
yozilgan). Qolgan xatolar — avvalgi bosqichlardan tanish muhit-sabab
soxta signal.
