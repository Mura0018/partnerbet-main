import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { getSlaMinutes } from "@/lib/cashdesk/sla";
import { getDebtSettings } from "@/lib/cashdesk/debt";
import { sendTelegramMessage } from "@/lib/telegram/notify";

// Ikki bosqichli tekshiruv (tashqi scheduler har 10-15 daqiqada uradi;
// CRON_CHECK_SECRET ?secret= bilan mos kelishi shart):
//
//  1) 4-BOSQICH HANDOFF — egasi bор buyurtma SLA muddati o'tsa YOKI owner
//     band (is_busy) bo'lsa: jamoa chatiga tizim xabari + handoff_open=true.
//     Endi boshqa operator UI'да "Olaman" bilan atomik o'z zimmasiga oladi.
//  2) MAVJUD "stale nudge" — SLA'siz (UI'да qo'lда olingan) buyurtma
//     STALE_MINUTES dan uzoq turib qolsa jamoa chatiga eslatma (regressiya
//     bo'lmasligi uchun saqlangan).
const STALE_MINUTES = 15;

export async function GET(req: NextRequest) {
  const expected = process.env.CRON_CHECK_SECRET;
  const provided = req.nextUrl.searchParams.get("secret");
  if (!expected || provided !== expected) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();
  const now = Date.now();

  // Tizim xabarini kimning nomidan yozamiz (super_admin) + operator ismlari + band ro'yxati.
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, full_name, display_name, is_busy, telegram_chat_id, roles(key)")
    .eq("is_active", true);
  const superAdmin = (profiles ?? []).find((p: any) => p.roles?.key === "super_admin");
  if (!superAdmin) return NextResponse.json({ handoff: 0, nudged: 0, error: "no_super_admin_to_post_as" });

  const nameById = new Map((profiles ?? []).map((p: any) => [p.id, p.display_name || p.full_name || "Operator"]));
  const busySet = new Set((profiles ?? []).filter((p: any) => p.is_busy).map((p: any) => p.id));

  // ---------- 1) SLA HANDOFF ----------
  let handoffCount = 0;
  try {
    const { data: owned } = await admin
      .from("telegram_orders")
      .select("id, type, amount, claimed_by, sla_deadline")
      .eq("status", "pending")
      .eq("handoff_open", false)
      .not("claimed_by", "is", null)
      .not("sla_deadline", "is", null);

    for (const order of (owned ?? []) as any[]) {
      const slaPassed = order.sla_deadline && new Date(order.sla_deadline).getTime() < now;
      const ownerBusy = busySet.has(order.claimed_by);
      if (!slaPassed && !ownerBusy) continue;

      const opName = nameById.get(order.claimed_by) ?? "Operator";
      const typeLabel = order.type === "topup" ? "Hisob to'ldirish" : "Pul yechish";
      const reason = ownerBusy ? "band" : "javob bermadi";

      await admin.from("team_chat_messages").insert({
        sender_id: superAdmin.id,
        is_system: true,
        message: `🔁 Tizim: ${opName} ${typeLabel} buyurtmasini (${Number(order.amount).toLocaleString("ru-RU")} so'm) ${reason} — boshqa operator "Olaman" bilan o'z zimmasiga olishi mumkin.`,
      });

      await admin
        .from("telegram_orders")
        .update({ handoff_open: true, claim_escalated_at: new Date().toISOString() })
        .eq("id", order.id);
      handoffCount++;
    }
  } catch {
    /* sla_deadline/handoff_open ustuni hali yo'q -> handoff o'tkazib yuboriladi */
  }

  // ---------- 2) MAVJUD STALE NUDGE (SLA'siz buyurtmalar) ----------
  const staleThreshold = new Date(now - STALE_MINUTES * 60 * 1000).toISOString();
  const { data: staleOrders } = await admin
    .from("telegram_orders")
    .select("id, type, amount, claimed_by, claimed_at")
    .eq("status", "pending")
    .not("claimed_by", "is", null)
    .lt("claimed_at", staleThreshold)
    .is("claim_escalated_at", null)
    .is("sla_deadline", null);

  let nudged = 0;
  for (const order of (staleOrders ?? []) as any[]) {
    const opName = nameById.get(order.claimed_by) ?? "Operator";
    const typeLabel = order.type === "topup" ? "Hisob to'ldirish" : "Pul yechish";
    const minutesAgo = Math.round((now - new Date(order.claimed_at as string).getTime()) / 60000);

    await admin.from("team_chat_messages").insert({
      sender_id: superAdmin.id,
      is_system: true,
      message: `🔔 Tizim: ${opName} ${typeLabel} buyurtmasini (${Number(order.amount).toLocaleString("ru-RU")} so'm) ${minutesAgo} daqiqadan beri ko'rib chiqmayapti. Unga xabar bering yoki boshqa operator ushlab olsin!`,
    });

    await admin.from("telegram_orders").update({ claim_escalated_at: new Date().toISOString() }).eq("id", order.id);
    nudged++;
  }

  // ---------- 3) 6-BOSQICH QARZ ESKALATSIYASI ----------
  // Ochiq (paid emas) qarz escalation_hours dan uzoq to'lanmasa -> adminга
  // (jamoa chati + super_admin Telegram). escalated_at bilan bir marta.
  let debtEscalated = 0;
  try {
    const { escalationHours } = await getDebtSettings();
    const cutoff = new Date(now - escalationHours * 60 * 60 * 1000).toISOString();
    const { data: staleDebts } = await admin
      .from("operator_debts")
      .select("id, debtor_operator_id, creditor_operator_id, amount")
      .neq("status", "paid")
      .is("escalated_at", null)
      .lt("created_at", cutoff);

    const superAdminChats = (profiles ?? [])
      .filter((p: any) => p.roles?.key === "super_admin" && p.telegram_chat_id)
      .map((p: any) => p.telegram_chat_id);

    for (const d of (staleDebts ?? []) as any[]) {
      const debtorName = nameById.get(d.debtor_operator_id) ?? "Operator";
      const creditorName = nameById.get(d.creditor_operator_id) ?? "Operator";
      const text = `⏰ Qarz to'lanmadi: ${debtorName} → ${creditorName}: ${Number(d.amount || 0).toLocaleString("ru-RU")} so'm (${escalationHours} soatdan oshdi).`;

      await admin.from("team_chat_messages").insert({ sender_id: superAdmin.id, is_system: true, message: `🟥 Tizim: ${text}` });
      await Promise.all(superAdminChats.map((c: number) => sendTelegramMessage(c, `🟥 BETCORE PAY\n\n${text}`, undefined)));
      await admin.from("operator_debts").update({ escalated_at: new Date().toISOString() }).eq("id", d.id);
      debtEscalated++;
    }
  } catch {
    /* operator_debts ustuni/jadval yo'q -> o'tkazib yuboriladi */
  }

  return NextResponse.json({ handoff: handoffCount, nudged, debtEscalated });
}
