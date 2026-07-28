import { NextRequest, NextResponse } from "next/server";
import { resolveCustomerContext } from "@/lib/telegram/resolveCustomer";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { checkAndRecordRateLimit, getClientIp } from "@/lib/security/rateLimit";
import { superAdminPosterId } from "@/lib/cashdesk/debt";

// W2.4: 1xbet kodi mijoz kiritgandan operator "1xbetdan yechib olish"ni
// bosgunga qadar eskirishi mumkin. Payout "noto'g'ri kod" bilan
// muvaffaqiyatsiz bo'lsa (payout_status 'none'ga qaytadi — payout/route.ts),
// mijoz shu endpoint orqali YANGI kod kiritadi — buyurtma bekor
// qilinmaydi, faqat kod yangilanadi.
export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);
  const { allowed } = await checkAndRecordRateLimit(`withdraw-refresh-code:${ip}`, 60, 10);
  if (!allowed) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const body = await req.json().catch(() => null);
  const { initData, orderId, code } = body ?? {};
  if (!initData || !orderId || !code || !String(code).trim()) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const cc = await resolveCustomerContext(initData);
  if (!cc || cc.denied || !cc.customer) return NextResponse.json({ error: "not_registered" }, { status: 401 });

  const admin = createAdminClient();
  const { data: order } = await admin
    .from("telegram_orders")
    .select("id, customer_id, type, status, payout_status")
    .eq("id", orderId)
    .maybeSingle();

  // Faqat 'none' holatidagi (ya'ni oldingi kod muvaffaqiyatsiz bo'lib,
  // yangisi kutilayotgan) o'ziga tegishli pending withdraw buyurtmasiga
  // kod yangilash mumkin — 'pending'/'success' holatida (payout hozir
  // ketyapti yoki allaqachon ketgan) YANGILAB BO'LMAYDI.
  if (
    !order ||
    (order as any).customer_id !== cc.customer.id ||
    (order as any).type !== "withdraw" ||
    (order as any).status !== "pending" ||
    (order as any).payout_status !== "none"
  ) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const { error } = await admin
    .from("telegram_orders")
    .update({ withdraw_code: String(code).trim().slice(0, 20) })
    .eq("id", orderId);
  if (error) return NextResponse.json({ error: "update_failed" }, { status: 500 });

  // Qayd etiladi — operator jamoa chatida ko'radi (mijoz yangi kod kiritdi).
  try {
    const poster = await superAdminPosterId(admin);
    if (poster) {
      await admin.from("team_chat_messages").insert({
        sender_id: poster,
        is_system: true,
        event_type: "status",
        message: `🔄 Tizim: mijoz buyurtma #${String(orderId).slice(0, 8)} uchun yangi yechish kodi kiritdi.`,
      });
    }
  } catch {
    /* qayd best-effort */
  }

  return NextResponse.json({ ok: true });
}
