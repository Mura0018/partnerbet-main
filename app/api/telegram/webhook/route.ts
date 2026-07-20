import { NextRequest, NextResponse } from "next/server";
import { getApiCredential } from "@/lib/auth/apiCredentials";
import { sendTelegramMessage, OPEN_APP_KEYBOARD } from "@/lib/telegram/notify";
import { createAdminClient } from "@/lib/supabaseAdmin";

const SECRET_HEADER = "x-telegram-bot-api-secret-token";

async function handleLinkCommand(chatId: number, text: string) {
  const code = text.replace(/^\/link/i, "").trim().toUpperCase();
  if (!code) {
    await sendTelegramMessage(chatId, "🟦 BETCORE PAY\n\nKodni kiriting: /link ABC123\n\nKodni admin panelda oling.", undefined);
    return;
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id, full_name, telegram_link_code_expires_at")
    .eq("telegram_link_code", code)
    .maybeSingle();

  if (!profile || !profile.telegram_link_code_expires_at || new Date(profile.telegram_link_code_expires_at).getTime() < Date.now()) {
    await sendTelegramMessage(chatId, "🟦 BETCORE PAY\n\n❌ Kod noto'g'ri yoki muddati tugagan. Admin panelda yangi kod oling.", undefined);
    return;
  }

  await admin
    .from("profiles")
    .update({ telegram_chat_id: chatId, telegram_link_code: null, telegram_link_code_expires_at: null })
    .eq("id", profile.id);

  await sendTelegramMessage(
    chatId,
    `🟦 BETCORE PAY\n\n✅ Ulandi! Endi yangi buyurtmalar haqida shu yerga xabar kelib turadi.`,
    undefined
  );
}

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
      "🟦 BETCORE PAY\n\nAssalomu alaykum! BetCore Pay botiga xush kelibsiz.\n\n💳 Hisob to'ldirish\n💵 Pul yechish\n🎧 Operator bilan aloqa\n\nBoshlash uchun quyidagi tugmani bosing:",
      OPEN_APP_KEYBOARD
    );
  } else if (/^\/link\b/i.test(text)) {
    await handleLinkCommand(chatId, text);
  } else {
    await sendTelegramMessage(chatId, "🟦 BETCORE PAY\n\nIlovani ochish uchun quyidagi tugmani bosing:", OPEN_APP_KEYBOARD);
  }

  return NextResponse.json({ ok: true });
}
