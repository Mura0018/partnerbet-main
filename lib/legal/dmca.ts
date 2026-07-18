import type { Locale } from "@/lib/i18n/dictionaries";
import type { LegalPageContent } from "@/lib/legal/about";

export const dmcaContent: Record<Locale, LegalPageContent> = {
  uz: {
    title: "DMCA siyosati",
    intro: "PartnerBet mualliflik huquqlarini hurmat qiladi va qonuniy DMCA (yoki tegishli mahalliy qonun) da'volariga javob beradi.",
    sections: [
      { heading: "Da'vo yuborish", body: "Agar sizningcha, saytimizdagi kontent sizning mualliflik huquqingizni buzayotgan bo'lsa, Aloqa sahifasi orqali quyidagi ma'lumotlar bilan murojaat qiling: (1) buzilgan asarning tavsifi, (2) buzuvchi kontentning aniq manzili (URL), (3) sizning aloqa ma'lumotlaringiz, (4) huquq egasi yoki uning vakili ekanligingizni tasdiqlovchi bayonot." },
      { heading: "Ko'rib chiqish jarayoni", body: "Har bir asosli da'vo ko'rib chiqiladi va tasdiqlangan taqdirda tegishli kontent oqilona muddatda olib tashlanadi yoki tuzatiladi." },
      { heading: "Qarshi bildirishnoma", body: "Agar kontentingiz noto'g'ri olib tashlangan deb hisoblasangiz, tushuntirish bilan qarshi bildirishnoma yuborishingiz mumkin." },
      { heading: "Suiiste'mol", body: "Asossiz yoki yolg'on da'volar yuborish qonuniy javobgarlikka olib kelishi mumkin." },
    ],
  },
  ru: {
    title: "Политика DMCA",
    intro: "PartnerBet уважает авторские права и реагирует на законные претензии DMCA (или соответствующего местного законодательства).",
    sections: [
      { heading: "Подача претензии", body: "Если вы считаете, что контент на нашем сайте нарушает ваши авторские права, обратитесь через страницу Контакты, указав: (1) описание нарушенного произведения, (2) точный адрес (URL) нарушающего контента, (3) ваши контактные данные, (4) заявление о том, что вы являетесь правообладателем или его представителем." },
      { heading: "Процесс рассмотрения", body: "Каждая обоснованная претензия рассматривается, и в случае подтверждения соответствующий контент удаляется или исправляется в разумные сроки." },
      { heading: "Встречное уведомление", body: "Если вы считаете, что ваш контент был удалён ошибочно, вы можете подать встречное уведомление с объяснением." },
      { heading: "Злоупотребление", body: "Подача необоснованных или заведомо ложных претензий может повлечь юридическую ответственность." },
    ],
  },
  en: {
    title: "DMCA Policy",
    intro: "PartnerBet respects copyright and responds to legitimate DMCA (or applicable local law) claims.",
    sections: [
      { heading: "Filing a claim", body: "If you believe content on our site infringes your copyright, contact us via the Contact page with: (1) a description of the infringed work, (2) the exact address (URL) of the infringing content, (3) your contact information, (4) a statement that you are the rights holder or their authorized representative." },
      { heading: "Review process", body: "Every substantiated claim is reviewed, and if confirmed, the relevant content is removed or corrected within a reasonable timeframe." },
      { heading: "Counter-notice", body: "If you believe your content was removed in error, you may submit a counter-notice with an explanation." },
      { heading: "Abuse", body: "Filing unfounded or knowingly false claims may result in legal liability." },
    ],
  },
};
