import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { superAdminPosterId } from "@/lib/cashdesk/debt";

// =========================================================
// W1.3 — BUYURTMA MUDDATI + ABANDON ANIQLASH.
// Tashqi scheduler bilan uriladi (check-stale-claims bilan bir xil
// naqsh: CRON_CHECK_SECRET ?secret= bilan mos kelishi shart).
//
//  1) Muddati o'tgan (site_settings.betcore_abandon_settings.order_expiry_min
//     dan uzoq turgan) pending buyurtmalar -> status='expired'.
//  2) Har expired buyurtma mijozning abandoned_streak'ini +1 qiladi.
//     Ketma-ket abandon_streak_limit'ga yetsa -> customers.blocked_until
//     o'rnatiladi (block_duration_min) + jamoa chatiga signal.
//  3) Mijoz biror buyurtmani MUVAFFAQIYATLI yakunlasa (completed) — streak
//     nolga tushadi (bu qism /api/admin/telegram-orders/status'da, W1.3
//     bilan bir vaqtda qo'shilgan).
// =========================================================
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
    .eq("key", "betcore_abandon_settings")
    .maybeSingle();
  const settings = (settingsRow?.value as any) ?? {};
  const expiryMin = Number(settings.order_expiry_min) || 30;
  const streakLimit = Number(settings.abandon_streak_limit) || 3;
  const blockMin = Number(settings.block_duration_min) || 60;

  const cutoff = new Date(Date.now() - expiryMin * 60000).toISOString();
  const nowIso = new Date().toISOString();

  const { data: staleOrders } = await admin
    .from("telegram_orders")
    .select("id, customer_id, type, amount")
    .eq("status", "pending")
    .lt("created_at", cutoff);

  let expiredCount = 0;
  let blockedCount = 0;

  for (const order of (staleOrders ?? []) as any[]) {
    // Atomik: faqat hali ham 'pending' bo'lsa (operator shu oraliqda
    // hal qilgan bo'lishi mumkin — bunday holatda expired qilinmaydi).
    const { data: updated } = await admin
      .from("telegram_orders")
      .update({ status: "expired", expired_at: nowIso })
      .eq("id", order.id)
      .eq("status", "pending")
      .select("id");
    if (!updated || updated.length === 0) continue;
    expiredCount++;

    try {
      const { data: cust } = await admin
        .from("customers")
        .select("abandoned_streak")
        .eq("id", order.customer_id)
        .maybeSingle();
      const nextStreak = ((cust as any)?.abandoned_streak ?? 0) + 1;
      const patch: Record<string, any> = { abandoned_streak: nextStreak };
      const shouldBlock = nextStreak >= streakLimit;
      if (shouldBlock) patch.blocked_until = new Date(Date.now() + blockMin * 60000).toISOString();
      await admin.from("customers").update(patch).eq("id", order.customer_id);

      if (shouldBlock) {
        blockedCount++;
        const poster = await superAdminPosterId(admin);
        if (poster) {
          await admin.from("team_chat_messages").insert({
            sender_id: poster,
            is_system: true,
            event_type: "alert",
            message: `🟥 Tizim: mijoz ketma-ket ${nextStreak} marta buyurtma ochib to'lamadi (oxirgisi #${order.id.slice(0, 8)}) — ${blockMin} daqiqaga bloklandi.`,
          });
        }
      }
    } catch {
      /* abandon-streak/blok best-effort — expired holatining o'zi baribir yozildi */
    }
  }

  return NextResponse.json({ expired: expiredCount, blocked: blockedCount });
}
