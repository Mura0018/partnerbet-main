import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { sendTelegramMessage } from "@/lib/telegram/notify";

// Har kuni bir marta (tashqi scheduler chaqiradi, CRON_CHECK_SECRET
// ?secret= bilan mos kelishi shart) jamoaning Telegram guruhiga qisqa
// holat xabari yuboradi — quruq "OK" emas, sana + oxirgi sutka statistikasi
// + tizim holati. Qabul qiluvchi chat site_settings.daily_team_signal.chat_id
// orqali sozlanadi (admin panel > Boshqaruv markazi) — kodga qattiq yozilmagan.
// Chat sozlanmagan bo'lsa hech narsa yubormaydi (fail-soft).
export async function GET(req: NextRequest) {
  const expected = process.env.CRON_CHECK_SECRET;
  const provided = req.nextUrl.searchParams.get("secret");
  if (!expected || provided !== expected) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();

  const { data: settingsRow } = await admin
    .from("site_settings")
    .select("value")
    .eq("key", "daily_team_signal")
    .maybeSingle();
  const rawChatId = (settingsRow?.value as any)?.chat_id;
  const chatId = Number(rawChatId);
  if (!rawChatId || !Number.isFinite(chatId)) return NextResponse.json({ sent: false, reason: "chat_id_not_configured" });

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: orders } = await admin
    .from("telegram_orders")
    .select("status, handoff_open")
    .gte("created_at", since);
  const list = (orders ?? []) as { status: string; handoff_open: boolean | null }[];
  const total = list.length;
  const completed = list.filter((o) => o.status === "completed").length;
  const rejected = list.filter((o) => o.status === "rejected").length;
  const pending = list.filter((o) => o.status === "pending").length;
  const stuck = list.filter((o) => o.status === "pending" && o.handoff_open).length;

  const { data: staff } = await admin
    .from("profiles")
    .select("is_busy, roles(key)")
    .eq("is_active", true);
  const operators = ((staff ?? []) as any[]).filter((p) => p.roles?.key === "operator");
  const busyCount = operators.filter((p) => p.is_busy).length;

  const dateStr = new Date().toLocaleDateString("uz-UZ", { day: "2-digit", month: "long", year: "numeric" });
  const statusLine = stuck > 0
    ? `${stuck} ta buyurtma operator almashtirishni kutmoqda`
    : "barqaror";

  const text =
    `📊 BetCore Pay — kunlik holat\n\n` +
    `Sana: ${dateStr}\n` +
    `Oxirgi sutka: ${total} ta buyurtma (${completed} bajarilgan, ${rejected} rad etilgan, ${pending} kutilmoqda)\n` +
    `Faol operatorlar: ${operators.length} ta (${busyCount} band)\n` +
    `Tizim holati: ${statusLine}`;

  await sendTelegramMessage(chatId, text, undefined);

  return NextResponse.json({ sent: true, total, completed, rejected, pending, operators: operators.length });
}
