# Bosqich 7 — Ko'p-bot (multi-tenant) mini-app rejasi

> Maqsad: BITTA mini-app kodi KO'P hamkor botiga xizmat qilsin. Har hamkorning
> mijozi o'z botiga kiradi va appni HAMKOR ko'rinishida (o'z temasi, to'lovlari,
> brendi) ko'radi; buyurtmalar o'sha hamkor paneliga tushadi.
>
> Muhim: bizning o'z BetCore Pay appimiz ALLAQACHON bor va ishlaydi. Bu bosqich
> uni multi-tenant qiladi — yangi app yozmaymiz, borini kengaytiramiz. Mavjud
> ishlayotgan oqim BUZILMASLIGI kerak.

---

## 1. Asosiy g'oya (bir qarashda)

```
Hamkor mijozi  →  HAMKOR boti  →  (webhook + Web App URL)  →  BIZNING mini-app
                                                                    │
                                          app "qaysi hamkor?" ni aniqlaydi (bot token)
                                                                    │
                            hamkor temasi + to'lovlari + brendi bilan chiziladi
                                                                    │
                              buyurtma  →  partner_id bilan  →  HAMKOR paneli
```

Bitta URL, bitta kod — lekin bot token orqali "kim ekani" aniqlanib, har kimga
o'z ko'rinishi va o'z ma'lumoti.

---

## 2. Telegram tomoni: bot appga qanday ulanadi

Telegram'da mini-app botga ikki yo'l bilan biriktiriladi:
1. **Menu Button** (`setChatMenuButton`) — botning pastki "menu" tugmasi Web App URL'ni ochadi.
2. **Keyboard/inline tugma** — `web_app` tugmasi.

Hamkor botni ulaganda (token bergan payt) biz avtomatik:
- `setChatMenuButton` bilan uning botiga bizning app URL'ini o'rnatamiz
  (masalan `https://.../telegram-app` — hamkor bot tokeni orqali aniqlanadi).
- Botga **webhook** o'rnatamiz (`setWebhook`) — kelgan xabarlar bizning serverga.

Shunda: mijoz o'sha botni ochadi → menu → bizning app ochiladi.

---

## 3. Hamkorni qanday aniqlaymiz (eng muhim texnik nuqta)

Telegram mini-app ochilganda `initData` beradi. `initData` **o'sha bot tokeni bilan**
imzolangan. Biz serverda:
- Har hamkor bot tokenini bilamiz (`partner_api_credentials`, provider='telegram_bot').
- Kelgan `initData`ni har bir faol hamkor tokeni bilan tekshiramiz → qaysi token
  to'g'ri kelsa, o'sha **hamkor aniqlanadi** (partner_id).

Ya'ni app ochilganda "bu qaysi hamkorning boti" — bot token imzosi orqali topiladi.
(Alternativa: URL'ga `?p=<partner_slug>` qo'shish, lekin token-imzo yo'li xavfsizroq.)

---

## 4. DB o'zgarishlari (yangi SQL — Bosqich 8 bilan birlashadi)

Multi-tenant bo'lishi uchun asosiy jadvallar hamkorga bog'lanadi:
- `customers` → **`partner_id`** qo'shiladi (har mijoz qaysi hamkorники).
- `telegram_orders` → **`partner_id`** qo'shiladi (buyurtma qaysi hamkorники).
- `telegram_support_*` → **`partner_id`** (murojaatlar ham).
- Har biriga RLS: hamkor a'zolari faqat O'Z `partner_id`sini ko'radi;
  platforma super_admin hammasini.

> Bu — ehtiyotkorlik bilan qilinadi: mavjud (bizning o'z) buyurtmalar uchun
> `partner_id = NULL` (yoki bizning maxsus "platform" hamkor id) bo'ladi, shunda
> eski oqim buzilmaydi.

---

## 5. App o'zgarishlari (mavjud mini-app kengaytiriladi)

- App ochilganda: hamkorni aniqlash (3-bo'lim) → hamkor **sozlamalarini** yuklash:
  - **tema** (`theme_key`) → ranglar/dizayn shunga qarab.
  - **to'lov usullari** (`partner_payment_methods`) → mijozga o'sha raqamlar.
  - **brend** (nom/logo — kerak bo'lsa qo'shiladi).
- Buyurtma yuborishda: **`partner_id`** biriktiriladi → hamkor paneliga tushadi.
- Bizning o'z appimiz (couponbet.org) — hamkor aniqlanmasa, hozirgidek ishlaydi.

---

## 6. Operator/hamkor paneli tomoni

- Hamkor panelidagi **Buyurtmalar** bo'limi (hozir yo'q — qo'shiladi): faqat
  o'sha hamkor `partner_id`li buyurtmalar (RLS bilan).
- Bizning admin (super_admin): hamma hamkor buyurtmalarini ko'radi/filtrlaydi.

---

## 7. Avtomatik hisob-kitob (Bosqich 8)

Buyurtmalar `partner_id` bilan bo'lingach:
- Har hamkorning bajarilgan buyurtmalari hajmi hisoblanadi.
- `commission_pct` bo'yicha oylik komissiya **avtomatik** hisoblanib, `partner_invoices`ga
  yoziladi (hozir qo'lda yaratamiz — keyin avtomatlashtiramiz).

---

## 8. Bosqichma-bosqich reja (xavfsiz tartib)

1. **7.1** — Bot ulaganda `setWebhook` + `setChatMenuButton` (app URL) o'rnatish.
   Server webhook endpoint: kelgan update'ni bot token bo'yicha hamkorga bog'lash.
2. **7.2** — App'da hamkorni `initData`+token orqali aniqlash; hamkor topilsa uning
   tema/to'lovlarini yuklash (topilmasa — bizning standart oqim).
3. **7.3** — SQL: `customers`/`telegram_orders`ga `partner_id` + RLS. Eski qatorlar
   NULL (buzilmaydi). Buyurtma yaratishda `partner_id` yozish.
4. **7.4** — Hamkor panelida "Buyurtmalar" bo'limi (o'z `partner_id`si).
5. **8** — Avtomatik komissiya → invoice.

Har qadam alohida, sinаб, bizning mavjud app buzilmasligini tekshirib.

---

## 9. Sizdan nima kerak

- **Bitta haqiqiy test bot** (BotFather'dan) + tokeni — jonli sinov uchun.
- Har qadamni birga sinaymiz (men kod + deploy, siz real bot bilan tekshiruv).

---

## 10. Xavf va kafolat

- Bizning O'Z appimiz (couponbet.org) va boti **buzilmaydi** — hamkor aniqlanmasa
  hamma narsa hozirgidek.
- `partner_id` NULL = "platforma" (biz) — eski ma'lumot xavfsiz.
- Har o'zgarish alohida commit — oson qaytariladi.
