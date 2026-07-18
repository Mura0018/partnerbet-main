import type { Locale } from "@/lib/i18n/dictionaries";
import type { LegalPageContent } from "@/lib/legal/about";

export const disclaimerContent: Record<Locale, LegalPageContent> = {
  uz: {
    title: "Ogohlantirish va Affiliate oshkoralik",
    intro: "Ushbu sahifa PartnerBetning hamkorlik (affiliate) modeli va mazmuni bo'yicha ogohlantirishlarni o'z ichiga oladi.",
    sections: [
      { heading: "Affiliate hamkorlik", body: "PartnerBet ba'zi litsenziyalangan bahs kompaniyalari bilan affiliate (hamkorlik) shartnomasiga ega. Agar siz sayt orqali hamkor kompaniyaga o'tsangiz va ro'yxatdan o'tsangiz, PartnerBet komissiya olishi mumkin. Bu sizning xarajatlaringizga ta'sir qilmaydi." },
      { heading: "Ob'ektivlik", body: "Komissiya olishimizga qaramay, biz barcha hamkorlarni bir xil standart (litsenziya, foydalanuvchi sharhlari, taklif shartlari) asosida baholashga harakat qilamiz. Reyting va tartib faqat sof reklama to'lovi asosida belgilanmaydi." },
      { heading: "Tahlillar va bashoratlar", body: "Saytdagi o'yin tahlillari va statistik bashoratlar faqat ma'lumot maqsadida taqdim etiladi va hech qanday natijaga kafolat bermaydi. Bular professional maslahat sifatida qaralmasligi kerak." },
      { heading: "Tashqi havolalar", body: "Sayt uchinchi tomon kompaniyalarga havolalarni o'z ichiga oladi. Biz ularning kontenti, xavfsizligi yoki xizmat sifati uchun javobgar emasmiz." },
    ],
  },
  ru: {
    title: "Отказ от ответственности и раскрытие партнёрства",
    intro: "Эта страница содержит важные уведомления о партнёрской (affiliate) модели и содержании PartnerBet.",
    sections: [
      { heading: "Партнёрское сотрудничество", body: "PartnerBet имеет партнёрские (affiliate) соглашения с некоторыми лицензированными букмекерскими компаниями. Если вы переходите к партнёру через наш сайт и регистрируетесь, PartnerBet может получить комиссию. Это не влияет на ваши расходы." },
      { heading: "Объективность", body: "Несмотря на получение комиссии, мы стремимся оценивать всех партнёров по единым стандартам (лицензия, отзывы пользователей, условия предложений). Рейтинг и порядок не определяются исключительно размером рекламной оплаты." },
      { heading: "Аналитика и прогнозы", body: "Аналитика матчей и статистические прогнозы на сайте предоставляются исключительно в информационных целях и не гарантируют какого-либо результата. Их не следует рассматривать как профессиональный совет." },
      { heading: "Внешние ссылки", body: "Сайт содержит ссылки на сторонние компании. Мы не несём ответственности за их контент, безопасность или качество услуг." },
    ],
  },
  en: {
    title: "Disclaimer & Affiliate Disclosure",
    intro: "This page contains important notices about PartnerBet's affiliate model and content.",
    sections: [
      { heading: "Affiliate partnerships", body: "PartnerBet has affiliate agreements with some licensed betting companies. If you follow a link to a partner through our site and register, PartnerBet may earn a commission. This does not affect your costs." },
      { heading: "Objectivity", body: "Despite earning commissions, we strive to evaluate all partners against the same standards (licensing, user reviews, offer terms). Ranking and order are not determined solely by advertising payment." },
      { heading: "Analysis and predictions", body: "Match analysis and statistical predictions on the site are provided for informational purposes only and do not guarantee any outcome. They should not be treated as professional advice." },
      { heading: "External links", body: "The site contains links to third-party companies. We are not responsible for their content, security, or quality of service." },
    ],
  },
};
