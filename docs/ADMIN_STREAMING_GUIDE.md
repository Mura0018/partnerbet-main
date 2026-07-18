# ADMIN_STREAMING_GUIDE.md — Live Streaming boshqaruvi

## 1. Sozlashni boshlash

`Admin > Live Streaming` bo'limiga o'ting (`streaming.manage` ruxsati
kerak — Super Admin, Admin va Content Manager rollariga standart
biriktirilgan).

## 2. Provider qo'shish

**Providers** tabida **Add Provider**:

| Maydon | Nima kiritiladi |
|---|---|
| Nomi | Rasmiy translatsiya hamkoringizning nomi |
| Slug | Avtomatik yaratiladi, xohlasangiz o'zgartiring |
| Base API URL | Hamkor bergan API manzili (masalan `https://api.hamkor.com`) |
| Priority | Kichikroq raqam = yuqoriroq ustuvorlik |

Saqlagandan so'ng, ro'yxatdagi 🔑 (kalit) belgisini bosib, **API Key**
va (agar kerak bo'lsa) **API Secret**ni kiriting. Bu qiymatlar
**shifrlanib** saqlanadi va saqlangandan keyin qayta ko'rsatilmaydi —
faqat "Sozlangan" holati ko'rinadi.

## 3. Ulanishni tekshirish

Har bir provider qatorida **Test Connection** tugmasi bor. Bosilganda:
- Hamkor API'sining `/status` manzili chaqiriladi.
- Natija darhol ko'rsatiladi va provider qatoridagi holat (Connected/Error)
  yangilanadi.
- Xato bo'lsa, aniq xabar ko'rsatiladi va **Error Logs**ga yoziladi
  (hozircha ro'yxat ko'rinishida emas, lekin `streaming_connection_logs`
  jadvalida saqlanadi — kelajakda alohida jurnal ko'rinishi qo'shilishi
  mumkin).
- **Diqqat**: bir provider uchun 5 daqiqada 5 martadan ko'p bosib
  bo'lmaydi (suiste'moldan himoya).

## 4. O'yinga oqim biriktirish

**Match Streams** tabida:

1. **Football provider**ni tanlang (o'yin qaysi Football Data
   tizimidan olinganini bildiradi — API-Football/Sportmonks/
   Football-Data.org, Football Center'dagi bilan bir xil).
2. **O'yin (fixture) ID**ni kiriting — buni Football Center yoki admin
   panelning Football bo'limidan topasiz.
3. **Streaming provider**ni tanlang.
4. Agar hamkorning o'zida bu o'yin uchun alohida stream ID bo'lsa,
   **Provайderdagi stream ID** maydoniga kiriting (bo'sh qoldirilsa,
   o'yin ID'sining o'zi ishlatiladi).
5. Agar bu **asosiy** oqim bo'lsa, "Primary provider"ni belgilang.
6. Kerak bo'lsa boshlanish/tugash vaqtini kiriting (masalan, translatsiya
   o'yin boshlanishidan 10 daqiqa oldin ochilishi uchun).
7. **Qo'shish**.

**Bir nechta provider qo'shish** — xuddi shu o'yin uchun yana bir marta
yuqoridagi qadamlarni takrorlang, boshqa providerni tanlab. Birinchisini
"Primary" qilib qoldiring — qolganlari ochiq saytda tanlov sifatida
ko'rinadi.

## 5. Ochiq saytda qanday ko'rinadi

- Football Center'dagi **jonli o'yinlar** va **Featured Matches**
  bo'limlarida, agar o'sha o'yin uchun faol oqim biriktirilgan bo'lsa,
  **"▶ Watch Live"** tugmasi avtomatik paydo bo'ladi.
- Agar bir nechta provider bo'lsa, tugma bosilganda tanlov ro'yxati
  ochiladi.
- Agar hech qanday oqim biriktirilmagan bo'lsa, tugma **umuman
  ko'rinmaydi** — bo'sh yoki o'chirilgan holatda emas.

## 6. Oqimni vaqtincha o'chirish

Har bir "Match Stream" qatorida "Faol/Faolsiz" tugmasi bor —
o'yin tugagandan keyin yoki muammo yuzaga kelganda tezda o'chirib
qo'yishingiz mumkin, o'yin/provайder yozuvini o'chirmasdan.

## Muhim: faqat rasmiy hamkorlar

Bu tizim **faqat litsenziyalangan, rasmiy ruxsat berilgan translatsiya
hamkorlari** uchun mo'ljallangan. Ruxsatsiz yoki noqonuniy oqim
manbalarini qo'shish yoki reklama qilish qat'iyan man etiladi va
PartnerBetning huquqiy pozitsiyasiga (`/legal/disclaimer`) zid.
