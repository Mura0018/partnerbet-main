import { NextRequest, NextResponse } from "next/server";
import { getApiCredential } from "@/lib/auth/apiCredentials";
import { resolveCustomerContext } from "@/lib/telegram/resolveCustomer";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { checkAndRecordRateLimit, getClientIp } from "@/lib/security/rateLimit";
import { findCashdeskPlayer, cashdeskPayout } from "@/lib/cashdesk/client";
import { resolveOrderCashdesk } from "@/lib/cashdesk/pickCashdesk";
import { getCashdeskCredsById, type Creds } from "@/lib/cashdesk/store";
import { getSlaMinutes } from "@/lib/cashdesk/sla";
import { superAdminPosterId } from "@/lib/cashdesk/debt";

// WITHDRAW A-OQIMI, 2-qadam: mijoz kodни kiritадi -> PAYOUT chaqiriladi
// (pul 1xbetдан kassага tortiladi, QAYTMAS). Muvaffaqiyatли bo'lса buyurtма
// darhol yaratiladi (pul kuzatilishi SHART). Summa API'дан keladi (kod
// ичидаги). Rekvizit/usul keyingi (details) qadamда to'ldiriladi.
export async function POST(req: NextRequest) {
  const botToken = await getApiCredential("telegram_bot_token");
  if (!botToken) return NextResponse.json({ error: "not_configured" }, { status: 500 });

  const ip = getClientIp(req.headers);
  const { allowed } = await checkAndRecordRateLimit(`withdraw-payout:${ip}`, 60, 10);
  if (!allowed) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const body = await req.json().catch(() => null);
  const { initData, platform, accountId, code } = body ?? {};
  if (!initData || !platform || !accountId || !code) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  const cc = await resolveCustomerContext(initData);
  if (!cc || cc.denied || !cc.customer) return NextResponse.json({ error: "not_registered" }, { status: 401 });
  const customer = cc.customer;

  const admin = createAdminClient();

  // Kill-switch
  const { data: swRow } = await admin.from("site_settings").select("value").eq("key", "betcore_switches").maybeSingle();
  if ((swRow?.value as any)?.withdraw === false) return NextResponse.json({ error: "withdraw_disabled" }, { status: 403 });

  // Pending limit
  const { count: pendingCount } = await admin.from("telegram_orders").select("id", { count: "exact", head: true }).eq("customer_id", customer.id).eq("status", "pending");
  if ((pendingCount ?? 0) >= 3) return NextResponse.json({ error: "too_many_pending_orders" }, { status: 400 });

  // Kassa (egasi -> resolveOrderCashdesk); pul shu kassaга tortiladi.
  const { data: ownerRow } = await admin.from("customers").select("owner_operator_id").eq("id", customer.id).maybeSingle();
  const ownerOperatorId = (ownerRow as any)?.owner_operator_id ?? null;
  let cashdeskId: string | null = null;
  let creds: Creds | undefined = undefined;
  try {
    cashdeskId = await resolveOrderCashdesk(ownerOperatorId);
    if (cashdeskId) { const c = await getCashdeskCredsById(cashdeskId); if (c) creds = c; }
  } catch {
    /* default kassa */
  }

  const acc = String(accountId).trim();

  // ID tekshiruvi + F.I.Sh. (avto)
  const lookup = await findCashdeskPlayer(acc, creds);
  const playerName = lookup.ok ? (lookup.data.name ?? null) : null;
  if (!lookup.ok && lookup.error !== "not_configured" && lookup.error !== "network_error" && lookup.error !== "request_failed") {
    return NextResponse.json({ error: "player_not_found" }, { status: 404 });
  }

  // === PAYOUT: pul 1xbetдан tortiladi (kod bilan). QAYTMAS. ===
  const result = await cashdeskPayout(acc, String(code).trim(), creds);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: "payout_failed", detail: result.error });
  }
  const summa = Number(result.data.summa) || 0;

  // Buyurtма — pul tortilди, kuzatilishi SHART.
  const nowIso = new Date().toISOString();
  const slaMin = await getSlaMinutes();
  const { data: order, error } = await admin
    .from("telegram_orders")
    .insert({
      customer_id: customer.id,
      type: "withdraw",
      platform: String(platform).trim().slice(0, 50),
      account_id: acc.slice(0, 50),
      amount: summa,
      withdraw_code: String(code).trim().slice(0, 20),
      player_name: playerName,
      recipient_name: playerName,
      payout_done: true,
      payout_summa: summa,
      status: "pending",
      partner_id: cc.partnerId,
      cashdesk_id: cashdeskId,
      claimed_by: ownerOperatorId,
      claimed_at: ownerOperatorId ? nowIso : null,
      sla_deadline: ownerOperatorId ? new Date(Date.now() + slaMin * 60000).toISOString() : null,
    })
    .select("id, amount")
    .single();

  if (error || !order) {
    // ⚠️ KRITIK: pul tortilди, lekin buyurtма yozilmadi. Super adminга bildiramiz.
    try {
      const poster = await superAdminPosterId(admin);
      if (poster) {
        await admin.from("team_chat_messages").insert({
          sender_id: poster,
          is_system: true,
          event_type: "alert",
          message: `🟥 DIQQAT: ${acc} hisobidan ${summa.toLocaleString("ru-RU")} so'm Payout bajarildi, LEKIN buyurtма yozilmadi. Qo'lда tekshiring!`,
        });
      }
    } catch { /* log best-effort */ }
    return NextResponse.json({ ok: false, error: "order_save_failed", summa });
  }

  return NextResponse.json({ ok: true, orderId: order.id, summa, playerName });
}
