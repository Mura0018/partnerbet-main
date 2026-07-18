# CHANGELOG — Phase 6 (Production Readiness, Legal Pages & Polish)

## Qo'shildi

### Huquqiy sahifalar (9 ta, 3 tilda)
- `/about`, `/faq`, `/legal/privacy-policy`, `/legal/terms`,
  `/legal/cookie-policy`, `/legal/responsible-gaming`,
  `/legal/disclaimer`, `/legal/dmca` — barchasi to'liq, professional,
  o'zbek/rus/ingliz tillarida (`lib/legal/*.ts`).
- `/admin/faq` — FAQ boshqaruvi (Phase 1'dan beri ishlatilmagan `faqs`
  jadvalini birinchi marta ulaydi).
- `lib/i18n/getServerLocale.ts`, `lib/legal/LegalLocaleSwitcher.tsx` —
  Server Component sahifalar uchun til almashtirish mexanizmi.
- `lib/legal/LegalPageLayout.tsx` — barcha huquqiy sahifalar uchun
  umumiy, izchil qatlam.

### SEO
- `app/sitemap.ts` — dinamik sitemap (statik + postlar + yangiliklar +
  hamkorlar).
- `app/robots.ts` — robots.txt, admin/auth/api yashiringan.
- **Structured data (JSON-LD)**: `Organization` (root layout), `Article`
  (blog va football news detali), `FAQPage` (`/faq`).

### Production Polish
- `app/loading.tsx` — yagona yuklanish holati.
- `lib/ui/Breadcrumbs.tsx` — Blog, Football News, Partner detal
  sahifalarida qo'llanildi.

## O'zgartirildi

- `lib/ui/PublicFooter.tsx`, `app/page.tsx` (bosh sahifa footer'i) —
  "Affiliate Disclosure"/"Licensing" "Tez orada" holatlari olib
  tashlandi, o'rniga to'liq Legal (6 havola) va Company (About/FAQ)
  bo'limlari — barcha havolalar real.
- `app/error.tsx`, `app/not-found.tsx` — eski rang qiymatlari (Phase 5
  paytida qolib ketgan) yangi accent rangiga moslashtirildi.
- `middleware.ts`, `app/admin/layout.tsx` — `/admin/faq` route va nav
  bandi qo'shildi.

## Sifat nazorati (QA) natijalari

To'liq loyiha bo'ylab tekshiruv o'tkazildi:
- ❌ O'lik kod (`TODO`/`console.log`) — topilmadi
- ❌ Buzilgan ichki havolalar — topilmadi (har bir `href` mos sahifaga
  ega ekanligi skript orqali tasdiqlandi)
- ❌ Ishlatilmagan fayllar — topilmadi
- ✅ **Ishlatilmagan jadval topildi va tuzatildi**: `faqs` (yuqoriga
  qarang)
- ✅ Eski rang nomuvofiqliklari topildi va tuzatildi

## Tekshiruv

Barcha yangi/o'zgargan fayllar `tsc --strict` bilan tekshirildi. Bu
bosqichda ma'lumotlar bazasi sxemasiga o'zgarish kiritilmadi (mavjud
`faqs` jadvali ishlatildi). Qolgan xatolar — avvalgi bosqichlardan
tanish muhit-sabab soxta signal (`key` prop).

## Keyingi qadam

Foydalanuvchi so'ragan **Final Release** bosqichi — yakuniy deploy
qo'llanmasi, to'liq README yangilanishi va loyihaning umumiy yakuniy
tekshiruvi.
