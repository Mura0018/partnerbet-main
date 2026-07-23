# Hamkorlik tizimi — qo'llanma (admin uchun)

Bu hujjat BetCore Pay **hamkorlik (partner) tizimi** qanday ishlashini va super admin
uni qanday boshqarishini tushuntiradi. Maqsad — adminга ishni **oson** qilish.

---

## 1. Asosiy g'oya

Hamkor — bu **alohida kompaniya (tenant)**. U bizning **panelimiz va appimizdan**
foydalanib, o'z mijozlariga xizmat ko'rsatadi:

- O'z **paneli** (biz beramiz)
- O'z **API'lari** (masalan 1xbet — xuddi biz ishlatgandek)
- O'z **xodimlari** (partner admin + xodimlar)
- O'z **valyutasi** va kompaniyasi

Biz faqat **texnologiyani** beramiz va **komissiya yoki obuna** orqali daromad olamiz.
Har hamkor ma'lumoti **to'liq izolyatsiya** (RLS) — biri ikkinchisini ko'rmaydi.

---

## 2. Rollar

| Rol | Kim | Nimani ko'radi |
|-----|-----|----------------|
| **Platforma super admin** (biz) | Sizsiz | HAMMA hamkor, hisob-kitob, xizmatlar |
| **Partner admin** | Hamkorning kattasi | Faqat O'Z hamkori: xodimlar, API, sozlama, o'z hisob-kitobi |
| **Partner xodim (staff)** | Hamkorning operatori | Faqat O'Z hamkori doirasida ishlaydi |

---

## 3. Oqim: hamkor qanday paydo bo'ladi

```
1) Mijoz appda "Hamkor bo'ling" bannerini bosadi
       ↓  (marketing sahifa — foizlar aytilmaydi, faqat jalb qilish)
2) "Bog'lanish" tugmasi orqali operator bilan aloqaga chiqadi
       ↓
3) SUPER ADMIN /admin/partners da yangi hamkor yaratadi
   (nomi, kompaniya, valyuta, model: komissiya% yoki obuna)
       ↓
4) SUPER ADMIN to'loviga yarasha XIZMATLARNI qo'lda yoqadi
   (topup, withdraw, chat, 1xbet API, analitika ...)
       ↓
5) Partner admin o'z API'larini ulaydi, xodim qo'shadi — ishni boshlaydi
```

> Marketing sahifada (mijoz app) **foizlar/komissiya ko'rsatilmaydi** — u yerda faqat
> hamkor jalb qilish va yo'naltirish bor. Shartlar keyin, aloqa orqali kelishiladi.

---

## 4. Xizmat biriktirish (provisioning)

Hamkor yaratilgach, super admin unga **to'loviga yarasha** xizmatlarni yoqadi:

- `topup` — hisob to'ldirish
- `withdraw` — pul yechish
- `team_chat` — jamoa chati
- `global_chat` — global chat
- `api_1xbet` — 1xbet / kassa API
- `analytics` — analitika

Har hamkor faqat **yoqilgan** xizmatlardan foydalana oladi. Bu — obuna/tarif darajasini
belgilashning oddiy usuli.

---

## 5. Hisob-kitob (billing)

Hamkor ikki modeldan biri bilan to'laydi:

- **Komissiya (%)** — aylanmasidan foiz
- **Obuna** — oylik belgilangan summa

`partner_invoices` jadvalida har oy uchun yozuv yuritiladi:

| Ustun | Ma'no |
|-------|-------|
| `period` | Davr, masalan `2026-07` |
| `model` | `commission` yoki `subscription` |
| `amount` | To'lov summasi |
| `currency` | Valyuta |
| `status` | `unpaid` (to'lanmagan) / `paid` (to'langan) |

**Admin oqimi:** oy oxirida har hamkorga invoice yaratiladi → hamkor to'lasa `paid`
belgilanadi. Panelda "kutilayotgan to'lovlar" va "yig'ilgan daromad" ko'rinadi.

> Hozircha invoice **qo'lda** kiritiladi. Keyingi bosqichda, buyurtmalar hamkorlarga
> bo'lingach (`partner_id`), komissiya **avtomatik** hisoblanadi.

---

## 6. Xavfsizlik

- **RLS** har jadvalda: hamkor faqat `current_partner_id()` = o'zinikini ko'radi.
- **API sirlari** (`partner_api_credentials`) brauzerga **umuman o'qilmaydi** — faqat
  server (service role) API chaqirig'ida ishlatadi.
- Partner admin o'z hamkori doirasidan tashqariga **chiqa olmaydi**.
- Faqat platforma super admin (`partners.manage`) hamma narsani ko'radi/boshqaradi.

---

## 7. Ma'lumotlar bazasi (jadvallar)

| Jadval | Vazifa |
|--------|--------|
| `partners` | Hamkor: nom, holat, model, komissiya/obuna, valyuta, kompaniya |
| `partner_members` | Partner admin + xodimlar |
| `partner_api_credentials` | Hamkorning maxfiy API'lari |
| `partner_chat_messages` | Hamkorning ichki chati |
| `global_chat_messages` | Global chat |
| `partner_services` | Xizmatlar katalogi |
| `partner_service_assignments` | Hamkorga yoqilgan xizmatlar |
| `partner_invoices` | Hisob-kitob (to'lovlar) |

---

## 8. Bosqichlar (yo'l xaritasi)

- [x] **1** — Poydevor: partners, members, api, chatlar, RLS (0058)
- [x] **2** — Super admin: Hamkorlar boshqaruvi sahifasi (`/admin/partners`)
- [x] **3** — Mijoz appda "Hamkorlik" marketing sahifasi (3D)
- [ ] **4** — Provisioning + hisob-kitob (0059) → UI (davom etmoqda)
- [ ] **5** — Global chat + hamkor chati (drawer)
- [ ] **6** — Buyurtma/mijozlarni `partner_id` bilan bo'lish + avtomatik komissiya
