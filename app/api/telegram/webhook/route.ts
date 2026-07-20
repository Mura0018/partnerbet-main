import { NextRequest, NextResponse } from "next/server";
import { getApiCredential } from "@/lib/auth/apiCredentials";

async function sendMessage(token: string, chatId: number, text: string, replyMarkup?: any) {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      reply_markup: replyMarkup,
    }),
  });
}

const MAIN_MENU = {
  inline_keyboard: [
    [
      { text: "↓ Hisob to'ldirish", callback_data: "topup" },
      { text: "↑ Pul yechish", callback_data: "withdraw" },
    ],
    [
      { text: "☰ Buyurtmalarim", callback_data: "orders" },
      { text: "☎ Operator bilan aloqa", callback_data: "operator" },
    ],
  ],
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

  const callback = update.callback_query;
  if (callback?.message?.chat?.id) {
    const chatId = callback.message.chat.id;
    const action = callback.data;

    await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callback.id }),
    });

    if (action === "topup") {
      await sendMessage(token, chatId, "Hisob to'ldirish bo'limi tez orada ishga tushadi.");
    } else if (action === "withdraw") {
      await sendMessage(token, chatId, "Pul yechish bo'limi tez orada ishga tushadi.");
    } else if (action === "orders") {
      await sendMessage(token, chatId, "Sizda hozircha buyurtmalar yo'q.");
    } else if (action === "operator") {
      await sendMessage(token, chatId, "Operator bilan aloqa tez orada qo'shiladi.");
    }
    return NextResponse.json({ ok: true });
  }

  const message = update.message;
  if (!message?.chat?.id) return NextResponse.json({ ok: true });

  const chatId = message.chat.id;
  const text: string = message.text ?? "";

  if (text === "/start") {
    await sendMessage(
      token,
      chatId,
      "Assalomu alaykum! BetCore Pay botiga xush kelibsiz.\n\nQuyidagi menyudan birini tanlang:",
      MAIN_MENU
    );
  } else {
    await sendMessage(token, chatId, "Buyruqni tushunmadim. /start ni yuboring.");
  }

  return NextResponse.json({ ok: true });
}
