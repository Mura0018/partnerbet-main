import type { Locale } from "@/lib/i18n/dictionaries";

export type LegalSection = { heading: string; body: string };
export type LegalPageContent = { title: string; intro?: string; sections: LegalSection[] };

export const aboutContent: Record<Locale, LegalPageContent> = {
  uz: {
    title: "Biz haqimizda",
    intro:
      "WINORA — futbol tahlillari, jonli natijalar va litsenziyalangan hamkorlar haqidagi ma'lumotlarni bir joyga jamlagan mustaqil media va affiliate platforma.",
    sections: [
      {
        heading: "Nima qilamiz",
        body:
          "Biz kunlik futbol yangiliklari, o'yin tahlillari, turnir jadvallari va statistikani nashr etamiz. Bundan tashqari, litsenziyalangan букmeker kompaniyalari bilan hamkorlik qilib, ularning promo-kodlari va takliflari haqida ob'ektiv ma'lumot beramiz.",
      },
      {
        heading: "Biz kim emasmiz",
        body:
          "WINORA o'zi bahs qabul qilmaydi, foydalanuvchi mablag'larini saqlamaydi va o'yin operatori sifatida faoliyat yuritmaydi. Har qanday moliyaviy tranzaksiya to'g'ridan-to'g'ri tegishli litsenziyalangan hamkor kompaniya bilan amalga oshiriladi — biz faqat ma'lumot va yo'naltiruvchi havolalar taqdim etamiz.",
      },
      {
        heading: "Qadriyatlarimiz",
        body:
          "Shaffoflik, aniqlik va mas'uliyatli o'yin g'oyasini targ'ib qilish — bizning ishimiz asosida yotadi. Har bir hamkor kompaniya haqida ma'lumot berishdan oldin uning litsenziyasini tekshiramiz.",
      },
      {
        heading: "Bog'lanish",
        body:
          "Savol yoki takliflaringiz bo'lsa, Aloqa sahifasi orqali biz bilan bog'lanishingiz mumkin.",
      },
    ],
  },
  ru: {
    title: "О нас",
    intro:
      "WINORA — независимая медиа- и партнёрская платформа, объединяющая футбольную аналитику, live-результаты и информацию о лицензированных партнёрах.",
    sections: [
      {
        heading: "Чем мы занимаемся",
        body:
          "Мы публикуем ежедневные футбольные новости, аналитику матчей, турнирные таблицы и статистику. Также сотрудничаем с лицензированными букмекерскими компаниями, предоставляя объективную информацию об их промокодах и предложениях.",
      },
      {
        heading: "Кем мы не являемся",
        body:
          "WINORA сам не принимает ставки, не хранит средства пользователей и не выступает в роли игорного оператора. Любая финансовая операция происходит напрямую с соответствующей лицензированной компанией-партнёром — мы предоставляем только информацию и переходные ссылки.",
      },
      {
        heading: "Наши ценности",
        body:
          "Прозрачность, точность и продвижение идеи ответственной игры лежат в основе нашей работы. Перед публикацией информации о партнёре мы проверяем наличие у него лицензии.",
      },
      {
        heading: "Связь с нами",
        body: "Если у вас есть вопросы или предложения, свяжитесь с нами через страницу Контакты.",
      },
    ],
  },
  en: {
    title: "About Us",
    intro:
      "WINORA is an independent media and affiliate platform bringing together football analytics, live results, and information about licensed betting partners.",
    sections: [
      {
        heading: "What we do",
        body:
          "We publish daily football news, match analysis, league tables, and statistics. We also partner with licensed bookmaker companies to provide objective information about their promo codes and offers.",
      },
      {
        heading: "What we are not",
        body:
          "WINORA does not itself accept wagers, does not hold user funds, and does not operate as a gambling operator. Any financial transaction happens directly with the relevant licensed partner company — we only provide information and referral links.",
      },
      {
        heading: "Our values",
        body:
          "Transparency, accuracy, and promoting responsible gambling are at the core of what we do. We verify each partner's licensing status before publishing information about them.",
      },
      {
        heading: "Get in touch",
        body: "If you have questions or suggestions, reach out to us via the Contact page.",
      },
    ],
  },
};
