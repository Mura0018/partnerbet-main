import { NextRequest, NextResponse } from "next/server";
import { getApiCredential } from "@/lib/auth/apiCredentials";
import { sendTelegramMessage } from "@/lib/telegram/notify";

const MINIAPP_URL = "https://www.couponbet.org/telegram-app";
const SECRET_HEADER = "x-telegram-bot-api-secret-token";

const OPEN_APP_MENU = {
  inline_keyboard: [[{ text: "🚀 Ilovani ochish", web_app: { url: MINIAPP_URL } }]],
};

export async function POST(req: NextRequest) {
  const token = await getApiCredential("telegram_bot_token");
  if (!token) return NextResponse.json({ ok: false, error: "not_configured" }, { status: 200 });

  // Telegram sends back whatever secret_token was set on setWebhook — if
  // one is configured here, reject anything that doesn't match. This is
  // the only thing standing between this public URL and a spoofed update,
  // since Telegram webhooks have no other built-in verification.
  const configuredSecret = await getApiCredential("telegram_webhook_secret");
  if (configuredSecret) {
    const received = req.headers.get(SECRET_HEADER);
    if (received !== configuredSecret) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }
  }

  let update: any;
  try {
    update = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 200 });
  }

  const message = update.message;
  if (!message?.chat?.id) return NextResponse.json({ ok: true });

  const chatId = message.chat.id;
  const text: string = message.text ?? "";

  if (text === "/start") {
    await sendTelegramMessage(
      chatId,
      "Assalomu alaykum! BetCore Pay botiga xush kelibsiz.\n\nHisob to'ldirish, pul yechish va operator bilan bog'lanish uchun quyidagi ilovani oching:",
      OPEN_APP_MENU
    );
  } else {
    await sendTelegramMessage(chatId, "Ilovani ochish uchun /start ni yuboring.", OPEN_APP_MENU);
  }

  return NextResponse.json({ ok: true });
}
