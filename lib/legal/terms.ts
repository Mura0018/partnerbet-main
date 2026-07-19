import type { Locale } from "@/lib/i18n/dictionaries";
import type { LegalPageContent } from "@/lib/legal/about";

export const termsContent: Record<Locale, LegalPageContent> = {
  uz: {
    title: "Foydalanish shartlari",
    intro: "Ushbu shartlar WINORA (couponbet.org) saytidan foydalanishni tartibga soladi. Saytdan foydalanish orqali siz ushbu shartlarga rozilik bildirasiz.",
    sections: [
      { heading: "1. Xizmat tavsifi", body: "WINORA — futbol yangiliklari, tahlillari va litsenziyalangan hamkorlar haqidagi ma'lumotni taqdim etuvchi mustaqil media/affiliate platforma. Biz o'zimiz bahs qabul qilmaymiz." },
      { heading: "2. Yosh chegarasi", body: "Saytdan foydalanish uchun kamida 18 yoshda bo'lishingiz shart. Agar sizning mamlakatingizda qonuniy yosh chegarasi yuqoriroq bo'lsa, o'sha talab amal qiladi." },
      { heading: "3. Hisob majburiyatlari", body: "Agar admin hisobi yaratilgan bo'lsa, hisob egasi parolni maxfiy saqlash va hisob orqali amalga oshirilgan barcha harakatlar uchun javobgardir." },
      { heading: "4. Hamkor havolalari", body: "Sayt hamkor kompaniyalarga yo'naltiruvchi havolalarni o'z ichiga oladi. Bu havolalar orqali o'tganingizda, siz o'sha kompaniyaning shartlariga bo'ysunasiz — WINORA ularning xizmatlari uchun javobgar emas." },
      { heading: "5. Intellektual mulk", body: "Saytdagi barcha kontent (matn, dizayn, logotip) WINORA yoki tegishli litsenziya beruvchilarga tegishli. Ruxsatsiz nusxalash yoki tijorat maqsadida ishlatish taqiqlanadi." },
      { heading: "6. Javobgarlikni cheklash", body: "Sayt \"qanday bo'lsa shunday\" asosida taqdim etiladi. Biz hamkor kompaniyalarning xizmatlari, promo-kodlarining amal qilishi yoki natijalar uchun kafolat bermaymiz." },
      { heading: "7. Shartlarga o'zgartirish", body: "Ushbu shartlar vaqti-vaqti bilan yangilanishi mumkin. Saytdan foydalanishni davom ettirish yangilangan shartlarga rozilikni bildiradi." },
      { heading: "8. Amal qiluvchi qonun", body: "Ushbu shartlar operator ro'yxatdan o'tgan yurisdiksiya qonunlariga muvofiq talqin qilinadi." },
    ],
  },
  ru: {
    title: "Условия использования",
    intro: "Эти условия регулируют использование сайта WINORA (couponbet.org). Используя сайт, вы соглашаетесь с данными условиями.",
    sections: [
      { heading: "1. Описание услуги", body: "WINORA — независимая медиа-/партнёрская платформа, предоставляющая футбольные новости, аналитику и информацию о лицензированных партнёрах. Мы сами не принимаем ставки." },
      { heading: "2. Возрастное ограничение", body: "Для использования сайта вам должно быть не менее 18 лет. Если в вашей стране установлен более высокий возрастной порог, действует именно он." },
      { heading: "3. Обязанности владельца аккаунта", body: "Если создан аккаунт администратора, его владелец несёт ответственность за сохранение пароля в тайне и за все действия, совершённые через аккаунт." },
      { heading: "4. Партнёрские ссылки", body: "Сайт содержит ссылки на партнёрские компании. Переходя по ним, вы принимаете условия соответствующей компании — WINORA не несёт ответственности за их услуги." },
      { heading: "5. Интеллектуальная собственность", body: "Весь контент сайта (текст, дизайн, логотип) принадлежит WINORA или соответствующим лицензиарам. Копирование или коммерческое использование без разрешения запрещено." },
      { heading: "6. Ограничение ответственности", body: "Сайт предоставляется «как есть». Мы не гарантируем качество услуг партнёров, действительность промокодов или какие-либо результаты." },
      { heading: "7. Изменение условий", body: "Эти условия могут периодически обновляться. Продолжение использования сайта означает согласие с обновлёнными условиями." },
      { heading: "8. Применимое право", body: "Данные условия толкуются в соответствии с законодательством юрисдикции регистрации оператора." },
    ],
  },
  en: {
    title: "Terms & Conditions",
    intro: "These terms govern your use of the WINORA (couponbet.org) website. By using the site, you agree to these terms.",
    sections: [
      { heading: "1. Description of service", body: "WINORA is an independent media/affiliate platform providing football news, analysis, and information about licensed partners. We do not ourselves accept wagers." },
      { heading: "2. Age restriction", body: "You must be at least 18 years old to use the site. If your country sets a higher legal age, that requirement applies." },
      { heading: "3. Account responsibilities", body: "If an admin account has been created, the account holder is responsible for keeping the password confidential and for all actions taken through the account." },
      { heading: "4. Partner links", body: "The site contains links to partner companies. By following these links you become subject to that company's own terms — WINORA is not responsible for their services." },
      { heading: "5. Intellectual property", body: "All content on the site (text, design, logo) belongs to WINORA or its licensors. Unauthorized copying or commercial use is prohibited." },
      { heading: "6. Limitation of liability", body: "The site is provided \"as is.\" We do not guarantee the quality of partner services, the validity of promo codes, or any outcomes." },
      { heading: "7. Changes to these terms", body: "These terms may be updated periodically. Continued use of the site constitutes acceptance of the updated terms." },
      { heading: "8. Governing law", body: "These terms are interpreted in accordance with the laws of the operator's jurisdiction of registration." },
    ],
  },
};
