# MEDIA_LIBRARY_AND_PUSH.md — Phase 4

## 1. Media Library (`/admin/media`)

To'liq galereya UI — Phase 1'dan beri mavjud `media` jadval va Storage
bucket ustiga qurilgan (yangi jadval kerak emas edi):

- **Drag-and-drop ko'p fayl yuklash** — bir vaqtda bir nechta rasmni
  tashlash yoki bosib tanlash, har biri uchun progress ko'rsatiladi.
- **Qidiruv** — fayl nomi bo'yicha.
- **Nusxalash** — URL'ni bitta bosishda clipboard'ga.
- **O'chirish** — soft delete (Phase 1 naqshi), boshqa joyda ishlatilgan
  rasm o'chirilsa, o'sha joyda rasm ko'rinmay qoladi — bu **kutilgan
  xatti-harakat**, chunki hozircha "bu fayl qayerda ishlatilgan"
  bog'lanishini kuzatuvchi alohida jadval yo'q (quyida ko'lam eslatmasiga
  qarang).

Bu galereya endi barcha joylarda ishlatiladigan yuklash funksiyasi
(`lib/media/upload.ts` — logotip, muqova rasm, banner, video thumbnail)
bilan **bitta manba**dan foydalanadi — ikkinchi, alohida yuklash tizimi
yaratilmadi.

### Ko'lam eslatmasi
"Qayerda ishlatilgan" kuzatuvi (masalan, "bu rasm 3 ta postda ishlatilgan")
qo'shilmadi — bu har bir jadval-ustunni kuzatib boruvchi qo'shimcha
jadval/trigger talab qiladi, hozirgi loyihaning hajmi uchun ortiqcha
murakkablik. Fayl o'chirishdan oldin admin panelda tegishli joylarni
(Sozlamalar, Blog, Banner) qo'lda tekshirishi tavsiya etiladi.

## 2. Push Notifications (`/admin/push`)

To'liq ishlaydigan, uchtaan-oxirigacha (end-to-end) Web Push tizimi:

```
Tashrifchi brauzeri                    Server
┌─────────────────┐                  ┌──────────────────────┐
│ "Bell" tugmasi   │──ruxsat so'raydi→│                      │
│ (bosh sahifa)    │                  │                      │
│                  │←VAPID public key─│ /api/push/            │
│                  │                  │  vapid-public-key      │
│ PushManager      │                  │                      │
│  .subscribe()    │──obuna ma'lumoti→│ /api/push/subscribe   │
└─────────────────┘                  │  → push_subscriptions │
                                       └──────────────────────┘
                                                 │
Admin "/admin/push"da xabar yozadi ──────────────┘
                                                 │
                                    /api/admin/push/send
                                    (web-push + VAPID kalitlar)
                                                 │
                                    Har bir obunachiga yuboriladi
                                    (o'lik obunalar avtomatik o'chiriladi)
                                                 │
                                    public/sw.js → notification ko'rsatadi
```

### Xavfsizlik va arxitektura qarorlari

- **VAPID kalitlar** — Phase 3a'ning xavfsiz `api_credentials` naqshi
  orqali saqlanadi. Faqat **public** kalit maxsus, ataylab ochiq
  endpoint (`/api/push/vapid-public-key`) orqali beriladi — chunki bu
  kalit brauzer tomonidan talab qilinadi va **maxfiy emas** (VAPID
  dizaynining o'zi shunday: public/private juftlik, xuddi HTTPS
  sertifikati kabi). Private kalit hech qachon brauzerga chiqmaydi.
- **Obuna jadvali** (`push_subscriptions`) — login talab qilinmaydi
  (tashrifchi hisob yaratmasdan obuna bo'ladi). RLS: har kim obuna
  qo'sha oladi (`insert`) va **faqat o'z** `endpoint`i orqali obunani
  o'chira oladi (`delete`) — chunki `endpoint` qiymati brauzer push
  xizmati tomonidan beriladigan uzun, taxmin qilib bo'lmaydigan URL,
  amalda "token" vazifasini bajaradi. Ro'yxatni **ko'rish** esa faqat
  `settings.manage` huquqiga ega adminlarga.
- **Yuborish** — faqat `settings.manage` (server-side tekshiriladi,
  `/api/admin/push/send`), `web-push` kutubxonasi orqali.
- **O'lik obunalarni avtomatik tozalash** — yuborishda 404/410 xatosi
  qaytgan obuna (foydalanuvchi push'ni o'chirgan yoki brauzer eskirgan)
  darhol bazadan o'chiriladi — admin qo'lda tozalashi shart emas.
- **Yuborish tarixi** (`push_notification_log`) — har bir yuborishning
  auditi (necha kishiga yetdi, nechta xato).

### Service Worker

`public/sw.js` — minimal, faqat ikkita vazifa: kelgan push xabarini
bildirishnoma sifatida ko'rsatish va bosilganda to'g'ri sahifani ochish.
Middleware'ning texnik ishlar (`maintenance`) tekshiruvidan **ataylab
chetlashtirilgan** — aks holda texnik ishlar paytida service worker
o'rniga HTML sahifa qaytib, brauzerda xato beradi.

## Yangi migratsiya

`0028_media_library_and_push.sql`:
- `push_subscriptions` — obunalar (yuqorida tavsiflangan RLS bilan)
- `push_notification_log` — yuborish tarixi

`media` jadvali o'zgarmadi — Phase 1'dagi sxema galereya uchun allaqachon
yetarli edi.

## Yangi fayllar

| Fayl | Vazifasi |
|---|---|
| `public/sw.js` | Service worker |
| `lib/push/subscribe.ts` | Client: obuna bo'lish/bekor qilish |
| `lib/push/sendPush.ts` | Server: barcha obunachiga yuborish |
| `lib/push/NotificationBell.tsx` | Bosh sahifadagi yoqish/o'chirish tugmasi |
| `app/api/push/vapid-public-key/route.ts` | Faqat public kalitni beradi |
| `app/api/push/subscribe/`, `unsubscribe/` | Obuna CRUD |
| `app/api/admin/push/send/route.ts` | Admin yuborish |
| `app/admin/push/page.tsx` | Yozish va yuborish UI |
| `app/admin/media/page.tsx` | To'liq Media Library galereya |
| `package.json` | `web-push`, `@types/web-push` qo'shildi |

## Tekshiruv

Barcha yangi/o'zgargan fayllar `tsc --strict` bilan tekshirildi.
**Bitta haqiqiy xato topildi va tuzatildi**: `lib/push/subscribe.ts`da
`Uint8Array`/`BufferSource` mos kelmasligi (TypeScript 5.x'ning
generic typed array'larni qattiqlashtirishi sababli — brauzer Push
API'sining o'zi bilan bog'liq emas, faqat TS tipi aniqlashtirilishi
kerak edi, `as BufferSource` bilan tuzatildi). Qolgan xatolar — avvalgi
bosqichlardan tanish, `@types/react` va yangi paketlar
o'rnatilmagan tekshiruv muhiti sababli soxta signal.
