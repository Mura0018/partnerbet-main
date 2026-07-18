# CHANGELOG — Phase 3d (Professional News Management)

## Qo'shildi

### Ma'lumotlar bazasi (`0027_news_cms.sql`)
- `posts.cover_url`, `football_news.cover_url` — denormalized muqova
  rasm URL'i (mavjud naqsh bilan bir xil).

### Rich Text Editor
- `lib/editor/RichTextEditor.tsx` (TipTap) — to'liq formatlash asboblar
  paneli, rasm qo'shish (Media yuklash bilan integratsiya).
- `lib/editor/RichTextRenderer.tsx` — ochiq sahifalarda xavfsiz ko'rsatish.
- `lib/editor/sanitize.ts` — saqlashdan oldin VA ko'rsatishdan oldin HTML
  tozalash (`isomorphic-dompurify`).

### Kategoriya va Teg boshqaruvi (yangi UI, jadvallar Phase 1'dan)
- `/admin/categories` — Blog/Football News uchun, ota-bola ierarxiya,
  post soni.
- `/admin/tags` — global teglar, ishlatilish soni.

### Blog va Football News admin — to'liq qayta qurildi
- `/admin/blog` — Rich Text Editor, ko'p tegli tanlov, muqova rasmi, SEO
  maydonlari (`seo_title`/`seo_description`/`seo_keywords`), rejalashtirish.
- `/admin/football-news` — **yangi** (bu jadval Phase 1'dan beri bor edi,
  lekin hech qachon admin UI'ga ega bo'lmagan) — xuddi shu darajada to'liq.

### Ochiq o'qish sahifalari (yangi — muhim bo'shliqni to'ldirdi)
- `/blog` — ro'yxat + kategoriya filtri (Server Component, SEO-friendly).
- `/blog/{slug}` — to'liq maqola, `generateMetadata`, Open Graph, teglar,
  o'xshash maqolalar, ko'rishlar hisoblagichi.
- `/football/news/{slug}` — xuddi shunday football yangiliklari uchun.
- `app/api/content/track-view/route.ts` + `lib/ViewTracker.tsx` —
  xavfsiz ko'rishlar hisoblagichi (client-side fire-and-forget).

## O'zgartirildi

- `app/page.tsx` — "Blog" endi "tez orada" emas, haqiqiy `/blog`ga
  ulanadi; footer'ga "Football Center"/"Blog" havolalari qo'shildi.
- `app/football/page.tsx` — News kartalari endi `/football/news/{slug}`ga
  ulanadi.
- `middleware.ts` — `/admin/categories`, `/admin/tags`,
  `/admin/football-news` route tekshiruvlari qo'shildi.
- `app/admin/layout.tsx` — "Football News", "Kategoriyalar", "Teglar"
  nav bandlari.
- `tailwind.config.ts` — `@tailwindcss/typography` plagini ro'yxatga
  olindi (rich-text kontentni chiroyli render qilish uchun shart).
- `package.json` — `@tiptap/react`, `@tiptap/starter-kit`,
  `@tiptap/extension-link`, `@tiptap/extension-image`,
  `@tiptap/extension-placeholder`, `isomorphic-dompurify`,
  `@tailwindcss/typography` qo'shildi.

## Ko'lam chegaralari (ataylab)

- Football News teglarga ega emas (faqat kategoriya + liga matni) —
  ikkinchi tag-tizimi ortiqcha murakkablik, sababi `NEWS_CMS.md`da.
- Qidiruv funksiyasi qo'shilmadi — Phase 5 (Frontend/UX) rejasida.

## Xavfsizlik

- Rich-text HTML ikki marta tozalanadi (saqlashda + ko'rsatishda) —
  `<script>` va boshqa xavfli teglar/atributlar hech qachon saqlanmaydi
  yoki render qilinmaydi.
- Ko'rishlar hisoblagichi — jadvalning o'zi ochiq yozishga yopiq, faqat
  maxsus, cheklangan endpoint orqali (bir xil, allaqachon tasdiqlangan
  naqsh — `promo_codes.usage_count` bilan bir xil).

## Tekshiruv

Barcha yangi/o'zgargan fayllar `tsc --strict` bilan tekshirildi. Yangi
paketlar (`node_modules`da yo'q) tufayli kutilgan "modul topilmadi"
xabarlari e'tiborga olinmadi; qolgan xatolar — avvalgi bosqichlardan
tanish muhit-sabab soxta signal.

## Keyingi qadam

Phase 3 (PartnerBet Master CMS) to'liq yakunlandi: 3a (Site Settings),
3b (Affiliate Manager), 3c (Football Center), 3d (News CMS). Keyingi
qadam — asl yo'l xaritasidagi **Phase 4: Media Library va qo'shimcha
modullar** (to'liq Media galereya, drag-drop, Push Notifications yuborish
funksiyasi) yoki **Phase 5: Frontend dizayn** bo'lishi mumkin — qaysi
birini xohlaysiz?
