# LEGAL_PAGES.md — Phase 6

## Qamrov

9 ta sahifa, barchasi 3 tilda (o'zbek/rus/ingliz):

| Sahifa | Yo'l | Manba |
|---|---|---|
| About Us | `/about` | Statik kontent (`lib/legal/about.ts`) |
| Contact | `/contact` | Bazadan (`site_settings.contact_info`, Phase 5'da qurilgan) |
| FAQ | `/faq` | **Bazadan** (`faqs` jadvali — Phase 1'dan beri bor edi, hech qachon ishlatilmagan, endi to'liq admin UI bilan ulandi) |
| Privacy Policy | `/legal/privacy-policy` | Statik kontent |
| Terms & Conditions | `/legal/terms` | Statik kontent |
| Cookie Policy | `/legal/cookie-policy` | Statik kontent |
| Responsible Gaming | `/legal/responsible-gaming` | Statik kontent |
| Disclaimer (Affiliate oshkoralik) | `/legal/disclaimer` | Statik kontent |
| DMCA Policy | `/legal/dmca` | Statik kontent |

## Nega ba'zilari "statik", ba'zilari bazadan?

- **FAQ** — savol-javoblar tez-tez o'zgaradi, admin tomonidan tez-tez
  yangilanishi kerak → bazadan (`/admin/faq`, allaqachon mavjud bo'lgan
  jadvalga ulandi).
- **Privacy/Terms/Cookie/Responsible Gaming/Disclaimer/DMCA** — bu huquqiy
  hujjatlar odatda yurist/huquq guruhi tomonidan ehtiyotkorlik bilan
  ko'rib chiqilgandan keyin o'zgartiriladi, oddiy matn maydoni orqali
  tasodifiy tahrirlash xavfli. Shuning uchun kod ichida strukturaviy
  tarzda saqlanadi (`lib/legal/*.ts`) — o'zgartirish uchun dasturchi
  (yoki keyingi Claude sessiyasi) fayllarni to'g'ridan-to'g'ri tahrirlaydi,
  bu ataylab qilingan xavfsizlik-birinchi qaror.

## Til almashtirish qanday ishlaydi

Bu sahifalar **Server Component** (SEO uchun to'liq server-side render).
Auth oqimlaridagi (`LocaleProvider`) client-context'dan farqli o'laroq,
bu yerda til tanlovi `partnerbet_locale` cookie orqali saqlanadi va
`lib/i18n/getServerLocale.ts` orqali server tomonda o'qiladi.
`LegalLocaleSwitcher` (`lib/legal/LegalLocaleSwitcher.tsx`) tilni
o'zgartirganda cookie'ni yozadi va `router.refresh()` chaqiradi — bu
Server Component'ni yangi cookie bilan qayta so'raydi.

## FAQ — structured data (SEO)

`/faq` sahifasi `FAQPage` JSON-LD sxemasini avtomatik generatsiya qiladi
— Google qidiruv natijalarida "accordion" ko'rinishida chiqish imkoniyati.

## Footer integratsiyasi

Barcha 9 sahifa endi `PublicFooter` (va bosh sahifaning o'z footer'i)da
haqiqiy havolalar sifatida ko'rinadi — ilgari "Affiliate Disclosure" va
"Licensing" "Tez orada" holatida edi, endi butunlay olib tashlandi va
o'rniga to'liq Legal bo'limi (6 havola) + Company bo'limida About/FAQ
qo'shildi.

## Kontent sifati haqida eslatma

Har bir sahifa PartnerBetning haqiqiy pozitsiyasini aks ettiradi:
**mustaqil media/affiliate platforma, o'zi bahs qabul qilmaydi**. Bu
barcha 9 sahifada izchil takrorlanadi (ayniqsa Disclaimer va Responsible
Gaming'da) — huquqiy nuqtai nazardan eng muhim, chalkash bo'lmasligi
kerak bo'lgan fakt.
