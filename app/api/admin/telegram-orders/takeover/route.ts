import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { getSlaMinutes } from "@/lib/cashdesk/sla";
import { pickCashdeskForOwner } from "@/lib/cashdesk/pickCashdesk";

// 4-BOSQICH: handoff'ga chiqqan buyurtmani boshqa operator o'z zimmasiga
// oladi. ATOMIK LOCK: WHERE status='pending' AND handoff_open=true bilan
// UPDATE — bir vaqtda ikki operator bosса, faqat BITTASI muvaffaqiyat
// (birinchi UPDATE handoff_open=false qiladi, ikkinchisiga 0 qator mos
// keladi). Yangi egaga o'z SLA oynasi beriladi (u ham javob bermasa
// keyingi cron yana handoff ochadi).
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "forbidden" }, { status: 401 });

  const { data: allowed } = await supabase.rpc("has_permission", { perm_key: "telegram_orders.manage" });
  if (!allowed) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const { orderId } = body ?? {};
  if (!orderId) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  const slaMin = await getSlaMinutes();
  const admin = createAdminClient();

  // 6-BOSQICH: takeover'dан OLDINGI ega (asl owner) — atomik update
  // claimed_by ni bosib yozadi, shuning uchun avval o'qiб olamiz.
  const { data: pre } = await admin.from("telegram_orders").select("claimed_by").eq("id", orderId).maybeSingle();
  const previousOwner = (pre as any)?.claimed_by ?? null;

  const { data: updated } = await admin
    .from("telegram_orders")
    .update({
      claimed_by: user.id,
      claimed_at: new Date().toISOString(),
      handoff_open: false,
      sla_deadline: new Date(Date.now() + slaMin * 60000).toISOString(),
      claim_escalated_at: null,
    })
    .eq("id", orderId)
    .eq("status", "pending")
    .eq("handoff_open", true) // ATOMIK: faqat handoff ochiq bo'lsa; birinchi oluvchi yutadi
    .select("id, claimed_by");

  if (!updated || updated.length === 0) {
    // Boshqa operator ulgurdi yoki buyurtma allaqachon bajarildi.
    return NextResponse.json({ ok: false, error: "already_taken" });
  }

  // 6-BOSQICH (best-effort): asl owner'ni handoff_from ga saqlaymiz (qarz
  // uchun) + buyurtma kassasini B (o'ringa olgan) kassasiga o'tkazamiz —
  // pul B kassasidan ketsin. Ustunlar yo'q bo'lsa oqim buzilmaydi.
  try {
    const patch: Record<string, any> = {};
    if (previousOwner && previousOwner !== user.id) patch.handoff_from_operator_id = previousOwner;
    const bCashdesk = await pickCashdeskForOwner(user.id);
    if (bCashdesk) patch.cashdesk_id = bCashdesk;
    if (Object.keys(patch).length > 0) {
      await admin.from("telegram_orders").update(patch).eq("id", orderId);
    }
  } catch {
    /* qarz-kuzatuv maydonlari best-effort */
  }

  // Jamoa chatiga (best-effort) — kim olganini bildirish.
  try {
    const { data: me } = await admin.from("profiles").select("display_name, full_name").eq("id", user.id).maybeSingle();
    const name = (me as any)?.display_name || (me as any)?.full_name || "Operator";
    await admin.from("team_chat_messages").insert({
      sender_id: user.id,
      is_system: true,
      message: `✅ Tizim: ${name} handoff buyurtmani o'z zimmasiga oldi.`,
    });
  } catch {
    /* xabar best-effort */
  }

  return NextResponse.json({ ok: true, claimedBy: user.id });
}
