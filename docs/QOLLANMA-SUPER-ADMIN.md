# Super Admin qo'llanmasi — Hamkorlik tizimi (to'liq)

> Bu hujjat SIZ (platforma egasi / super admin) uchun. Hamkorni yaratgandan keyin
> nima qilishingiz, panelni qanday sozlashingiz va hamkor bilan qanday ishlashingiz
> to'liq yozilgan. Belgilar: **[tayyor]** — ishlayapti, **[rejada]** — quriladi.

---

## 0. Umumiy oqim (bir qarashda)

```
SO'ROV                YARATISH              PANEL BERISH           SOZLASH
appda ariza    →   hamkor profili    →   partner admin      →   plan + xizmat +
(So'rovlar)        (/admin/partners)      login yaratish         tema + limit
                                          (panelga kirish)
                                                                      ↓
                                          HAMKOR O'ZI SOZLAYDI:  bot token, tema,
                                          xodim, API, to'lov     → ISHNI BOSHLAYDI
                                                                      ↓
                        HISOB-KITOB: oylik komissiya/obuna → invoice → to'landi
```

---

## 1. Kim nima qiladi (rollar)

| Rol | Panel | Vazifa |
|-----|-------|--------|
| **Super admin** (siz) | `/admin` | Hamkor yaratish, plan/xizmat/tema berish, hisob-kitob, nazorat |
| **Partner admin** (hamkor kattasi) | `/partner` | O'z boti, temasi, xodimlari, API, to'lov usullari |
| **Partner xodim** | `/partner` | Faqat buyurtmalarni qayta ishlash |

> **Muhim:** Hamkor **alohida `/partner` panelida** ishlaydi — sizning `/admin`ingizni
> ko'rmaydi. Ma'lumotlar RLS bilan to'liq ajratilgan. [rejada]

---

## 2. Hamkorlik so'rovini qabul qilish  [tayyor]

1. `/admin/partners` → **So'rovlar** tab.
2. Yangi so'rovlar qizil son (badge) bilan turadi.
3. So'rovni o'qing (kompaniya, ism, telefon, xabar).
4. Bog'laning → holatni **"Bog'lanildi"** qiling.
5. Rozi bo'lsangiz → **"Hamkor yaratish"** (forma to'lgan holda ochiladi).

---

## 3. Hamkor yaratish  [tayyor]

`/admin/partners` → **Yangi hamkor**:
- **Nomi** — hamkor/kompaniya nomi
- **Kompaniya** — masalan `1xbet`
- **Valyuta** — UZS/USD/RUB/EUR/KZT/TRY
- **To'lov modeli** — Komissiya (%) yoki Obuna
- **Holat** — Faol / Kutilmoqda / To'xtatilgan

---

## 4. Hamkorga PANEL berish  [rejada — Bosqich 6]

Hamkor panelga kirishi uchun unga **login** kerak:

1. Hamkor detali → **A'zolar** → **"Partner admin yaratish"**:
   - Email + parol (yoki taklif havolasi)
   - Bu foydalanuvchi `partner_members` ga `partner_admin` sifatida bog'lanadi.
2. Hamkorga beriladi: **panel manzili** (`/partner`) + login + parol.
3. Hamkor kirib, o'z panelini ko'radi (faqat o'zinikini).

> Xodimlarni keyin hamkorning O'ZI qo'shadi (partner panelidan).

---

## 5. Panelni SOZLASH (provisioning)  [rejada — Bosqich 5]

Hamkor detali sahifasida (super admin):

### 5.1. Plan va to'lov
- **Plan:** free / premium
- **Model:** komissiya % yoki obuna summasi (Tariflar sahifasidan olinadi)

### 5.2. Xizmatlar (nimalardan foydalanadi)
Yoqib/o'chirasiz: `topup`, `withdraw`, `team_chat`, `global_chat`, `api_1xbet`, `analytics`.
Hamkor faqat **yoqilgan** xizmatlarni ko'radi.

### 5.3. Temalar
- **Classic** — bepul, doim ochiq.
- **Neon / Royal** — premium; to'lovga qarab **siz yoqasiz**.
Hamkor faqat ochilgan temalardan tanlaydi.

### 5.4. Limitlar (ixtiyoriy)
Bitta buyurtma maksimumi, kunlik mijoz limiti.

---

## 6. Tariflar (narxlar)  [rejada — Bosqich 5]

`/admin/tariffs` (yoki Sozlamalar ichida): premium tema narxi, oylik obuna narxi va h.k.
Bir marta belgilaysiz — hamma hamkorga amal qiladi.

---

## 7. Bot (hamkorning o'z mini-app'i)  [rejada — Bosqich 6-7]

- Bot tokenini **hamkorning O'ZI** kiritadi (panelidan).
- Tizim tokenni tekshiradi, webhook o'rnatadi, **"✅ ulangan"** holatini ko'rsatadi.
- Token **maxfiy** — hech kim (siz ham) ko'rmaydi, faqat server ishlatadi.
- Siz hamkor detalida faqat **"bot ulangan / ulanmagan"** holatini ko'rasiz.

> Hamkorning mijozlari o'sha bot orqali kiradi — app to'liq hamkor brendida (o'z temasi).

---

## 8. Hisob-kitob (billing)  [rejada — Bosqich 5/8]

`partner_invoices` orqali:
- Har oy hamkorga **invoice** yaratasiz (komissiya yoki obuna summasi).
- Hamkor to'lasa → **"to'landi"** belgilaysiz.
- Panel ko'rsatadi: **kutilayotgan to'lovlar** + **yig'ilgan daromad**.

> Buyurtmalar `partner_id` bilan bo'lingach (Bosqich 8), komissiya **avtomatik** hisoblanadi.

---

## 9. Nazorat va aloqa

- **So'rovlar inboxi** — yangi hamkorlik arizalari. [tayyor]
- **Global chat** — barcha hamkorlar bilan umumiy aloqa. [rejada]
- **Hamkor chati** — kerak bo'lsa aniq hamkor jamoasi bilan. [rejada]

---

## 10. Xavfsizlik (kafolatlar)

- Har hamkor faqat O'ZINIKINI ko'radi (RLS: `current_partner_id()`).
- Hamkor O'ZI plan/komissiya/status/bot-holatini **o'zgartira olmaydi** (DB trigger).
- Bot token va API sirlari **brauzerga chiqmaydi** (faqat server).
- Partner admin faqat o'z jamoasini boshqaradi.

---

## 11. Nosozlik bo'lsa — nima qilish

| Muammo | Yechim |
|--------|--------|
| Hamkor panelga kira olmayapti | A'zolik (`partner_members`) va `is_active` ni tekshiring |
| Bot ulanmayapti | Token to'g'riligini, BotFather'da webhook ruxsatini tekshiring |
| Hamkor xizmatni ko'rmayapti | O'sha xizmat yoqilganini (`partner_service_assignments`) tekshiring |
| Premium tema ochilmayapti | `partner_theme_access` da yoqilganini tekshiring |

---

## 12. Qurilish bosqichlari (yo'l xaritasi)

- [x] 1 — Poydevor (partners, members, api, chat, RLS)
- [x] 2 — Hamkorlar sahifasi
- [x] 3 — Appda "Hamkorlik" marketing + ariza (leads)
- [x] 4 — DB: bot/tema/tarif poydevori
- [ ] 5 — **Tariflar + har hamkorga provisioning (plan/xizmat/tema)**
- [ ] 6 — **Hamkor paneli `/partner`** (login, bot, tema, xodim, API, to'lov)
- [ ] 7 — **Ko'p-bot mini-app** (hamkor boti → mijozlari → o'z temasi)
- [ ] 8 — Buyurtma `partner_id` + avtomatik komissiya/hisob-kitob
