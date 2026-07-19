import type { Locale } from "@/lib/i18n/dictionaries";
import type { LegalPageContent } from "@/lib/legal/about";

export const cookiesContent: Record<Locale, LegalPageContent> = {
  uz: {
    title: "Cookie siyosati",
    intro: "Ushbu sahifa WINORA qanday cookie fayllardan foydalanishini tushuntiradi.",
    sections: [
      { heading: "Cookie nima?", body: "Cookie — brauzeringizda saqlanadigan kichik matn fayli. U sayt sizni eslab qolishi va afzalliklaringizni saqlashi uchun ishlatiladi." },
      { heading: "Zarur cookie'lar", body: "Tizimga kirish sessiyasini saqlash (Supabase autentifikatsiya cookie'lari) — bularsiz admin panelga kirish ishlamaydi. Bu cookie'lar o'chirib bo'lmaydi, chunki ular xizmatning asosiy qismi." },
      { heading: "Afzallik cookie'lari", body: "Til tanlovingizni (o'zbek/rus/ingliz) eslab qolish uchun bitta cookie (\"partnerbet_locale\") ishlatiladi." },
      { heading: "Analitika", body: "Sahifa ko'rishlar va o'yin qiziqishlari haqidagi anonim statistika to'planadi — bu shaxsni aniqlovchi cookie emas, faqat bazadagi hodisa yozuvi." },
      { heading: "Uchinchi tomon cookie'lari", body: "Hamkor kompaniya saytiga o'tganingizda, o'sha sayt o'z cookie siyosatiga ega bo'lishi mumkin — bu WINORA nazoratidan tashqarida." },
      { heading: "Cookie'larni boshqarish", body: "Brauzeringiz sozlamalaridan cookie'larni o'chirishingiz yoki bloklashingiz mumkin, lekin bu holda tizimga kirish va til tanlovi kabi funksiyalar ishlamasligi mumkin." },
    ],
  },
  ru: {
    title: "Политика Cookie",
    intro: "Эта страница объясняет, как WINORA использует файлы cookie.",
    sections: [
      { heading: "Что такое cookie?", body: "Cookie — небольшой текстовый файл, сохраняемый в вашем браузере. Он используется, чтобы сайт мог запомнить вас и ваши предпочтения." },
      { heading: "Необходимые cookie", body: "Хранение сессии входа (cookie аутентификации Supabase) — без них вход в админ-панель не работает. Эти cookie нельзя отключить, так как они являются основной частью сервиса." },
      { heading: "Cookie предпочтений", body: "Для запоминания выбранного языка (узбекский/русский/английский) используется один cookie («partnerbet_locale»)." },
      { heading: "Аналитика", body: "Собирается анонимная статистика о просмотрах страниц и интересах к матчам — это не идентифицирующий cookie, а просто запись события в базе данных." },
      { heading: "Cookie третьих сторон", body: "При переходе на сайт партнёрской компании у неё может быть собственная политика cookie — это вне контроля WINORA." },
      { heading: "Управление cookie", body: "Вы можете удалить или заблокировать cookie в настройках браузера, но в этом случае такие функции, как вход в систему и выбор языка, могут перестать работать." },
    ],
  },
  en: {
    title: "Cookie Policy",
    intro: "This page explains how WINORA uses cookies.",
    sections: [
      { heading: "What is a cookie?", body: "A cookie is a small text file stored in your browser. It's used so the site can remember you and your preferences." },
      { heading: "Essential cookies", body: "Login session storage (Supabase authentication cookies) — without these, admin panel login does not work. These cannot be disabled, as they are a core part of the service." },
      { heading: "Preference cookies", body: "One cookie (\"partnerbet_locale\") is used to remember your chosen language (Uzbek/Russian/English)." },
      { heading: "Analytics", body: "Anonymous statistics about page views and match interest are collected — this is not an identifying cookie, just an event record in our database." },
      { heading: "Third-party cookies", body: "When you visit a partner company's site, that site may have its own cookie policy — this is outside WINORA's control." },
      { heading: "Managing cookies", body: "You can delete or block cookies in your browser settings, though doing so may break features like login and language selection." },
    ],
  },
};
