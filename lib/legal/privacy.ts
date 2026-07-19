import type { Locale } from "@/lib/i18n/dictionaries";
import type { LegalPageContent } from "@/lib/legal/about";

export const privacyContent: Record<Locale, LegalPageContent> = {
  uz: {
    title: "Maxfiylik siyosati",
    intro: "Ushbu siyosat WINORA (couponbet.org) qanday ma'lumot to'plashi, ishlatishi va himoya qilishini tushuntiradi.",
    sections: [
      { heading: "1. Qaysi ma'lumotlarni to'playmiz", body: "Hisob yaratganda: ism, email manzili. Saytdan foydalanganda: qurilma turi, brauzer, taxminiy mamlakat (IP orqali), tashrif sanasi va ko'rilgan sahifalar. To'lov ma'lumotlarini biz umuman to'plamaymiz — bunday ma'lumotlar faqat hamkor kompaniyalarning o'z saytida qayta ishlanadi." },
      { heading: "2. Ma'lumotlardan qanday foydalanamiz", body: "To'plangan ma'lumotlar saytni ishga tushirish va yaxshilash, statistik tahlil, xavfsizlik (masalan, hisobga kirishga urinishlarni kuzatish) va — agar siz ruxsat bergan bo'lsangiz — push-bildirishnoma yuborish uchun ishlatiladi." },
      { heading: "3. Cookie fayllar", body: "Sayt sessiya boshqaruvi va til tanlovini eslab qolish uchun cookie fayllardan foydalanadi. Batafsil: Cookie Siyosati sahifasi." },
      { heading: "4. Ma'lumotlarni uchinchi tomonlarga uzatish", body: "Biz ma'lumotlaringizni sotmaymiz. Hamkor kompaniyaga o'tganingizda (masalan, promo-kod orqali), o'sha kompaniyaning o'z maxfiylik siyosati amal qiladi — biz ularning ma'lumotlarni qanday ishlatishini nazorat qila olmaymiz." },
      { heading: "5. Ma'lumotlarni saqlash muddati", body: "Hisob ma'lumotlari hisobingiz faol bo'lgan davrda saqlanadi. Analitik ma'lumotlar (masalan, sahifa ko'rishlar) agregatlashgan holda uzoqroq saqlanishi mumkin, lekin shaxsni aniqlash uchun ishlatilmaydi." },
      { heading: "6. Sizning huquqlaringiz", body: "Siz o'z hisobingizdagi ma'lumotlarni ko'rish, tuzatish yoki o'chirishni so'rashingiz mumkin — Aloqa sahifasi orqali murojaat qiling." },
      { heading: "7. O'zgarishlar", body: "Ushbu siyosat vaqti-vaqti bilan yangilanishi mumkin. Muhim o'zgarishlar haqida saytda e'lon qilamiz." },
    ],
  },
  ru: {
    title: "Политика конфиденциальности",
    intro: "Эта политика объясняет, какие данные собирает, использует и защищает WINORA (couponbet.org).",
    sections: [
      { heading: "1. Какие данные мы собираем", body: "При создании аккаунта: имя, email. При использовании сайта: тип устройства, браузер, приблизительная страна (по IP), дата посещения и просмотренные страницы. Платёжные данные мы вообще не собираем — они обрабатываются только на стороне компаний-партнёров." },
      { heading: "2. Как мы используем данные", body: "Собранные данные используются для работы и улучшения сайта, статистического анализа, безопасности (например, отслеживание попыток входа) и — при вашем согласии — отправки push-уведомлений." },
      { heading: "3. Файлы cookie", body: "Сайт использует cookie для управления сессией и запоминания выбора языка. Подробнее: страница Политика Cookie." },
      { heading: "4. Передача данных третьим лицам", body: "Мы не продаём ваши данные. При переходе к партнёрской компании (например, по промокоду) действует её собственная политика конфиденциальности — мы не контролируем, как они используют данные." },
      { heading: "5. Срок хранения данных", body: "Данные аккаунта хранятся, пока ваш аккаунт активен. Аналитические данные (например, просмотры страниц) могут храниться дольше в агрегированном виде, но не используются для идентификации личности." },
      { heading: "6. Ваши права", body: "Вы можете запросить просмотр, исправление или удаление данных вашего аккаунта — обратитесь через страницу Контакты." },
      { heading: "7. Изменения", body: "Эта политика может периодически обновляться. О существенных изменениях мы сообщим на сайте." },
    ],
  },
  en: {
    title: "Privacy Policy",
    intro: "This policy explains what data WINORA (couponbet.org) collects, uses, and protects.",
    sections: [
      { heading: "1. What data we collect", body: "When you create an account: name, email address. When using the site: device type, browser, approximate country (via IP), visit date, and pages viewed. We never collect payment data ourselves — that is processed solely on the partner company's own site." },
      { heading: "2. How we use data", body: "Collected data is used to operate and improve the site, for statistical analysis, security (e.g. tracking login attempts), and — if you've opted in — to send push notifications." },
      { heading: "3. Cookies", body: "The site uses cookies for session management and remembering your language choice. Details: the Cookie Policy page." },
      { heading: "4. Sharing data with third parties", body: "We do not sell your data. When you follow a link to a partner company (e.g. via a promo code), that company's own privacy policy applies — we do not control how they use data." },
      { heading: "5. Data retention", body: "Account data is retained while your account is active. Analytics data (e.g. page views) may be retained longer in aggregated form but is not used to identify you personally." },
      { heading: "6. Your rights", body: "You may request to view, correct, or delete your account data — contact us via the Contact page." },
      { heading: "7. Changes", body: "This policy may be updated from time to time. We will announce material changes on the site." },
    ],
  },
};
