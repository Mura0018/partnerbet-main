import { getApiCredential } from "@/lib/auth/apiCredentials";

// Fire-and-forget Telegram message send. Never throws — a failed
// notification (bot token missing, chat blocked the bot, network hiccup)
// must never fail the order/status-update request that triggered it.
export async function sendTelegramMessage(
  chatId: number,
  text: string,
  replyMarkup?: unknown
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
