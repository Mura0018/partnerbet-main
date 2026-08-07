import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";

// W2 qo'shimcha: payout_status='pending'da "osilib qolgan" (javob kelmagan,
// timeout) buyurtmalar uchun — FAQAT super_admin, FAQAT 1xbet/kassa
// balansini QO'LDA tekshirgandan keyin. Sabab MAJBURIY (kim/qachon/nega
// payout_response'ga qayd etiladi + jamoa chatiga signal).
async function requireSuperAdmin() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, status: 401 };
  const { data: profile } = await supabase.from("profiles").select("roles(key)").eq("id", user.id).maybeSingle();
  if ((profile as any)?.roles?.key !== "super_admin") return { ok: false as const, status: 403 };
  return { ok: true as const, userId: user.id };
}

export async function POST(req: NextRequest) {
  const check = await requireSuperAdmin();
  if (!check.ok) return NextResponse.json({ error: "forbidden" }, { status: check.status });

  const body = await req.json().catch(() => null);
  const { orderId, outcome, reason } = body ?? {};
  if (!orderId || (outcome !== "success" && outcome !== "failed") || !reason || !String(reason).trim()) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: order } = await admin
    .from("telegram_orders")
    .select("id, type, payout_status")
    .eq("id", orderId)
    .maybeSingle();

  if (!order || (order as any).type !== "withdraw" || (order as any).payout_status !== "pending") {
    return NextResponse.json({ error: "not_eligible" }, { status: 409 });
  }

  const nowIso = new Date().toISOString();
  const trimmedReason = String(reason).trim().slice(0, 500);
  // outcome="success" -> pul haqiqatan ketgan, "[2] mijozga yuborish" ochiladi.
  // outcome="failed"  -> pul ketmagan, qayta urinish uchun 'none'ga qaytariladi.
  const nextStatus = outcome === "success" ? "success" : "none";

  const { data: updated } = await admin
    .from("telegram_orders")
    .update({
      payout_status: nextStatus,
      payout_at: nowIso,
      payout_response: { manual_resolution: true, outcome, resolved_by: check.userId, reason: trimmedReason, resolved_at: nowIso },
    })
    .eq("id", orderId)
    .eq("payout_status", "pending")
    .select("id");

  if (!updated || updated.length === 0) {
    return NextResponse.json({ error: "already_resolved" }, { status: 409 });
  }

  try {
    const { data: me } = await admin.from("profiles").select("display_name, full_name").eq("id", check.userId).maybeSingle();
    const name = (me as any)?.display_name || (me as any)?.full_name || "Super admin";
    await admin.from("team_chat_messages").insert({
      sender_id: check.userId,
      is_system: true,
      event_type: "alert",
      message: `🛠️ Tizim: ${name} osilib qolgan payout holatini (buyurtma #${String(orderId).slice(0, 8)}) qo'lda hal qildi — ${
        outcome === "success" ? "pul KETGAN deb belgiladi." : "pul KETMAGAN deb belgiladi, qayta urinish mumkin."
      } Sabab: ${trimmedReason}`,
    });
  } catch {
    /* qayd best-effort */
  }

  return NextResponse.json({ ok: true, payoutStatus: nextStatus });
}
