import { NextRequest, NextResponse } from "next/server";
import { getApiCredential } from "@/lib/auth/apiCredentials";

async function sendMessage(token: string, chatId: number, text: string) {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

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
      "Assalomu alaykum! BetCore Pay botiga xush kelibsiz.\n\nHozircha sinov bosqichida — hisob to'ldirish va pul yechish menyusi tez orada qo'shiladi."
    );
  } else {
    await sendMessage(token, chatId, "Buyruqni tushunmadim. /start ni yuboring.");
  }

  return NextResponse.json({ ok: true });
}
