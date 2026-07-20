import { NextRequest, NextResponse } from "next/server";
import { getApiCredential } from "@/lib/auth/apiCredentials";

const MINIAPP_URL = "https://www.couponbet.org/telegram-app";

async function sendMessage(token: string, chatId: number, text: string, replyMarkup?: any) {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, reply_markup: replyMarkup }),
  });
}

const OPEN_APP_MENU = {
  inline_keyboard: [[{ text: "🚀 Ilovani ochish", web_app: { url: MINIAPP_URL } }]],
};

export async function POST(req: NextRequest) {
  const token = await getApiCredential("telegram_bot_token");
  if (!token) return NextResponse.json({ ok: false, error: "not_configured" }, { status: 200 });

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
    await sendMessage(
      token,
      chatId,
      "Assalomu alaykum! BetCore Pay botiga xush kelibsiz.\n\nHisob to'ldirish va pul yechish uchun quyidagi ilovani oching:",
      OPEN_APP_MENU
    );
  } else {
    await sendMessage(token, chatId, "Ilovani ochish uchun /start ni yuboring.");
  }

  return NextResponse.json({ ok: true });
}
