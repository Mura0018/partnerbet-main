import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { sendTelegramMessage } from "@/lib/telegram/notify";
import { shortOrderRef } from "@/lib/format/id";

// ---- Qotib qolgan to'lovlar signali (B4) ----
// payout_status='pending' yoki deposit_status='pending' bo'lib, ostonadan
// uzoq turgan buyurtmalar -> super_admin'larga Telegram. Yosh o'lchovi —
// updated_at (status 'pending'ga o'tganda yangilanadi; hech qachon yoshni
// oshirib ko'rsatmaydi). Ostona: site_settings.stuck_payment_alert.hours
// (yo'q bo'lsa STUCK_DEFAULT_HOURS). daily_team_signal kalitiga qo'shilmadi —
// boshqaruv markazi u kalitni faqat {chat_id} bilan qayta yozadi.
// Bu qism xato bersa kunlik signal baribir ishlaydi (fail-soft).
const STUCK_DEFAULT_HOURS = 2;
const STUCK_LIST_MAX = 10;

async function alertStuckPayments(admin: ReturnType<typeof createAdminClient>): Promise<number> {
  try {
    const { data: cfg } = await admin.from("site_settings").select("value").eq("key", "stuck_payment_alert").maybeSingle();
    const rawHours = Number((cfg?.value as any)?.hours);
    const hours = Number.isFinite(rawHours) && rawHours > 0 ? rawHours : STUCK_DEFAULT_HOURS;
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    const { data: rows, error } = await admin
      .from("telegram_orders")
      .select("id, type, amount, payout_status, deposit_status, updated_at")
      .or("payout_status.eq.pending,deposit_status.eq.pending")
      .lt("updated_at", cutoff)
      .order("updated_at", { ascending: true })
      .limit(50);
    if (error) return 0;
    const stuck = (rows ?? []) as { id: string; type: string; amount: number; payout_status: string; deposit_status: string; updated_at: string }[];
    if (stuck.length === 0) return 0;

    const { data: role } = await admin.from("roles").select("id").eq("key", "super_admin").maybeSingle();
    if (!role) return stuck.length;
    const { data: supers } = await admin
      .from("profiles")
      .select("telegram_chat_id")
      .eq("role_id", role.id)
      .eq("is_active", true)
      .not("telegram_chat_id", "is", null);
    const chats = [...new Set(((supers ?? []) as { telegram_chat_id: number | null }[]).map((p) => Number(p.telegram_chat_id)).filter((c) => Number.isFinite(c)))];
    if (chats.length === 0) return stuck.length;

    const now = Date.now();
    const lines = stuck.slice(0, STUCK_LIST_MAX).map((o) => {
      const kind = o.payout_status === "pending" ? "Payout" : "Deposit";
      const age = Math.floor((now - new Date(o.updated_at).getTime()) / 3600000);
      return `• ${shortOrderRef(o.id)} — ${kind}, ${Number(o.amount || 0).toLocaleString("ru-RU")} so'm, ~${age} soat`;
    });
    const more = stuck.length > STUCK_LIST_MAX ? `\n…va yana ${stuck.length - STUCK_LIST_MAX} ta` : "";
    const text =
      `🟥 DedPay — qotib qolgan to'lovlar\n\n` +
      `${stuck.length} ta buyurtma ${hours} soatdan ortiq javobsiz (pending) turibdi:\n` +
      `${lines.join("\n")}${more}\n\n` +
      `Kassa/platformada holatni qo'lda tekshiring va buyurtmada natijani belgilang.`;
    await Promise.allSettled(chats.map((c) => sendTelegramMessage(c, text, undefined)));
    return stuck.length;
  } catch {
    return 0;
  }
}

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

  // Jamoa chati sozlanmagan bo'lsa ham super_admin signali ishlaydi.
  const stuckPayments = await alertStuckPayments(admin);

  const { data: settingsRow } = await admin
    .from("site_settings")
    .select("value")
    .eq("key", "daily_team_signal")
    .maybeSingle();
  const rawChatId = (settingsRow?.value as any)?.chat_id;
  const chatId = Number(rawChatId);
  if (!rawChatId || !Number.isFinite(chatId)) return NextResponse.json({ sent: false, reason: "chat_id_not_configured", stuckPayments });

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
    `📊 DedPay — kunlik holat\n\n` +
    `Sana: ${dateStr}\n` +
    `Oxirgi sutka: ${total} ta buyurtma (${completed} bajarilgan, ${rejected} rad etilgan, ${pending} kutilmoqda)\n` +
    `Faol operatorlar: ${operators.length} ta (${busyCount} band)\n` +
    `Tizim holati: ${statusLine}`;

  await sendTelegramMessage(chatId, text, undefined);

  return NextResponse.json({ sent: true, total, completed, rejected, pending, operators: operators.length, stuckPayments });
}
