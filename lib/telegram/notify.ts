import { getApiCredential } from "@/lib/auth/apiCredentials";

const MINIAPP_URL = "https://www.couponbet.org/telegram-app";

// Attached to every customer-facing bot message so they can jump straight
// back into the Mini App from the notification itself, not just from /start.
export const OPEN_APP_KEYBOARD = {
  inline_keyboard: [[{ text: "🚀 Ilovaga qaytish", web_app: { url: MINIAPP_URL } }]],
};

// Fire-and-forget Telegram message send. Never throws — a failed
// notification (bot token missing, chat blocked the bot, network hiccup)
// must never fail the order/status-update request that triggered it.
export async function sendTelegramMessage(
  chatId: number,
  text: string,
  replyMarkup: unknown = OPEN_APP_KEYBOARD
): Promise<void> {
  const token = await getApiCredential("telegram_bot_token");
  if (!token) return;

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, reply_markup: replyMarkup }),
    });
  } catch {
    // Swallow — notification delivery is best-effort.
  }
}

const TYPE_LABEL: Record<"topup" | "withdraw", string> = {
  topup: "Hisob to'ldirish",
  withdraw: "Pul yechish",
};

function formatAmount(amount: number): string {
  return `${amount.toLocaleString("ru-RU")} so'm`;
}

export function buildOrderCreatedMessage(type: "topup" | "withdraw", amount: number): string {
  return (
    `🟦 BETCORE PAY\n\n` +
    `✅ ${TYPE_LABEL[type]} buyurtmangiz qabul qilindi\n\n` +
    `💰 Summa: ${formatAmount(amount)}\n` +
    `📌 Holat: ⏳ Kutilmoqda\n\n` +
    `Operator tez orada ko'rib chiqadi — natijani shu yerda va ilovada "Buyurtmalarim" bo'limida ko'rasiz.`
  );
}

export function buildOrderResolvedMessage(
  type: "topup" | "withdraw",
  amount: number,
  status: "completed" | "rejected",
  note?: string | null
): string {
  const isCompleted = status === "completed";
  return (
    `🟦 BETCORE PAY\n\n` +
    `${isCompleted ? "✅" : "❌"} ${TYPE_LABEL[type]} buyurtmangiz ${isCompleted ? "BAJARILDI" : "RAD ETILDI"}\n\n` +
    `💰 Summa: ${formatAmount(amount)}\n` +
    `📌 Holat: ${isCompleted ? "✅ Bajarildi" : "❌ Rad etildi"}\n` +
    (note
      ? `\n${isCompleted ? "📝 Operator izohi" : "📝 Sabab"}: ${note}`
      : isCompleted
      ? ""
      : `\nBatafsil uchun "Operator bilan aloqa" bo'limiga yozing.`)
  );
}

export function buildSupportReplyMessage(text: string): string {
  return `🟦 BETCORE PAY\n\n💬 Operator javobi:\n\n${text}`;
}
