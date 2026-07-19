import type { Locale } from "@/lib/i18n/dictionaries";
import type { LegalPageContent } from "@/lib/legal/about";

export const responsibleGamingContent: Record<Locale, LegalPageContent> = {
  uz: {
    title: "Mas'uliyatli o'yin",
    intro: "WINORA mas'uliyatli o'yin g'oyasini qo'llab-quvvatlaydi. Bahs — bu ko'ngilochar mashg'ulot bo'lishi kerak, moliyaviy muammolarni hal qilish vositasi emas.",
    sections: [
      { heading: "18 yosh chegarasi", body: "Bahs o'yinlari faqat 18 yoshga to'lgan shaxslar uchun mo'ljallangan. Agar sizning mamlakatingizda yuqoriroq yosh chegarasi belgilangan bo'lsa, o'sha talab amal qiladi." },
      { heading: "Ogohlantiruvchi belgilar", body: "Agar quyidagilarni sezsangiz — o'yinga sarflagan vaqt yoki pulni nazorat qila olmaslik, qarzga kirish, oila yoki ish bilan bog'liq muammolar, yo'qotishlarni \"qaytarib olish\" uchun qayta-qayta o'ynash — bu yordam so'rash vaqti kelganini bildiradi." },
      { heading: "O'zingizni qanday himoya qilish mumkin", body: "Ko'pchilik litsenziyalangan operatorlar depozit chegarasi, o'z-o'zini chetlatish (self-exclusion) va sessiya vaqt chegarasi kabi vositalarni taqdim etadi. Bu vositalardan foydalanish uchun tanlagan hamkor kompaniyaning o'z sahifasiga murojaat qiling." },
      { heading: "Yordam olish", body: "Agar o'yin sizga yoki yaqinlaringizga salbiy ta'sir qilayotgan bo'lsa, mahalliy mas'uliyatli o'yin yoki qimor bog'liqligi bo'yicha yordam xizmatlariga murojaat qilishni tavsiya etamiz." },
      { heading: "Bizning rolimiz", body: "WINORA o'zi bahs qabul qilmaydi — biz faqat ma'lumot beruvchi platformamiz. Litsenziyalangan operatorlar mas'uliyatli o'yin vositalarini taqdim etish uchun javobgar." },
    ],
  },
  ru: {
    title: "Ответственная игра",
    intro: "WINORA поддерживает принципы ответственной игры. Ставки должны быть развлечением, а не способом решения финансовых проблем.",
    sections: [
      { heading: "Возрастное ограничение 18+", body: "Азартные игры предназначены только для лиц старше 18 лет. Если в вашей стране установлен более высокий возрастной порог, действует именно он." },
      { heading: "Тревожные признаки", body: "Если вы замечаете следующее — невозможность контролировать время или деньги, потраченные на игру, долги, проблемы в семье или на работе, повторные попытки «отыграться» — это сигнал обратиться за помощью." },
      { heading: "Как защитить себя", body: "Многие лицензированные операторы предлагают лимиты депозита, самоисключение и ограничение времени сессии. Для использования этих инструментов обратитесь на сайт выбранной компании-партнёра." },
      { heading: "Получение помощи", body: "Если игра негативно влияет на вас или ваших близких, рекомендуем обратиться в местные службы поддержки по вопросам ответственной игры или игровой зависимости." },
      { heading: "Наша роль", body: "WINORA сам не принимает ставки — мы только информационная платформа. За предоставление инструментов ответственной игры отвечают лицензированные операторы." },
    ],
  },
  en: {
    title: "Responsible Gaming",
    intro: "WINORA supports the principles of responsible gaming. Betting should be entertainment, not a way to solve financial problems.",
    sections: [
      { heading: "18+ age restriction", body: "Gambling is intended only for individuals aged 18 and over. If your country sets a higher age threshold, that requirement applies." },
      { heading: "Warning signs", body: "If you notice the following — inability to control time or money spent gambling, going into debt, problems with family or work, repeatedly chasing losses — it's time to seek help." },
      { heading: "How to protect yourself", body: "Many licensed operators offer deposit limits, self-exclusion, and session time limits. To use these tools, visit your chosen partner company's own site." },
      { heading: "Getting help", body: "If gambling is negatively affecting you or your loved ones, we recommend reaching out to local responsible gambling or gambling addiction support services." },
      { heading: "Our role", body: "WINORA does not itself accept wagers — we are an information platform only. Licensed operators are responsible for providing responsible gaming tools." },
    ],
  },
};
