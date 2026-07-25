# CLAUDE.md — Ishlash qoidalari

Bu loyihada ishlashda quyidagi qoidalarga **har doim** amal qilinadi. Ular foydalanuvchi tomonidan belgilangan va majburiy.

## Asosiy qoidalar

1. **Hech qachon katta o'zgarishni birdan qilma.** Katta ishlarni bir urinishda amalga oshirma.

2. **Har bir vazifani kichik bosqichlarga bo'l.** Har bir bosqich mustaqil va tushunarli bo'lsin.

3. **Avval tegishli fayllarni to'liq o'qib tahlil qil.** Kod yozishdan oldin kontekstni to'liq tushun.

4. **Kod yozishdan oldin reja tuz.** Rejada quyidagilar bo'lsin:
   - qanday yondashuv qo'llaniladi
   - qaysi fayllar o'zgaradi (aniq ro'yxat)

5. **Foydalanuvchi tasdig'isiz kod yozishni boshlama.** Reja tasdiqlangandan keyingina kod yoziladi.

6. **Har bosqich tugagach qisqa hisobot ber:**
   - qaysi fayllar o'zgardi
   - nima o'zgardi
   - nima uchun o'zgardi
   - qanday test qilindi

7. **Mavjud ishlayotgan funksiyalarni buzma.** Regressiyaga yo'l qo'yma; o'zgarish faqat mo'ljallangan joyga ta'sir qilsin.

8. **Ishonching bo'lmasa taxmin qilma.** Avval kodni o'qib, tushuntir, so'ng harakat qil.

9. **Har bir bosqich Git rollback qilish oson bo'ladigan darajada kichik bo'lsin.** Bir bosqich = bitta mantiqiy, orqaga qaytarish oson bo'lgan o'zgarish.

10. **Shu qoidalarga kelajakdagi barcha ishlarda amal qil.**

## Til

- Foydalanuvchi bilan muloqot **o'zbek tilida** olib boriladi.

## Loyiha haqida qisqacha

- **Stek:** Next.js + Supabase (TypeScript, Tailwind CSS).
- Ildiz papkada ko'plab `.zip` patch bundle fayllari mavjud — bular tarixiy o'zgarishlar to'plami.
