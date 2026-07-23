import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";

// 5-BOSQICH: telefon tasdiqini qayd qilish (Ha/Yo'q + summa + izoh).
// Faqat MAS'UL operator (buyurtmani olgan claimed_by / bajargan operator_id)
// yoki super_admin qayd qiladi. Qaydlar O'CHIRILMAYDI — har biri tarix
// (nizoda dalil). Bir buyurtmaga bir necha qayd bo'lishi mumkin.
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "forbidden" }, { status: 401 });

  const { data: allowed } = await supabase.rpc("has_permission", { perm_key: "telegram_orders.manage" });
  if (!allowed) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const { orderId, confirmed, amount, note } = body ?? {};
  if (!orderId || typeof confirmed !== "boolean") {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: order } = await admin
    .from("telegram_orders")
    .select("id, claimed_by, operator_id")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Mas'ul operator yoki super_admin bo'lishi kerak.
  const { data: me } = await admin.from("profiles").select("roles(key)").eq("id", user.id).maybeSingle();
  const isSuperAdmin = (me as any)?.roles?.key === "super_admin";
  const isResponsible = (order as any).claimed_by === user.id || (order as any).operator_id === user.id;
  if (!isResponsible && !isSuperAdmin) {
    return NextResponse.json({ ok: false, error: "not_responsible" }, { status: 403 });
  }

  const amt =
    confirmed && amount != null && amount !== "" && Number.isFinite(Number(amount)) ? Number(amount) : null;

  const { data: confirmation, error } = await admin
    .from("order_confirmations")
    .insert({
      order_id: orderId,
      operator_id: user.id,
      confirmed,
      amount: amt,
      note: note ? String(note).trim().slice(0, 500) : null,
    })
    .select("id, operator_id, confirmed, amount, note, created_at")
    .maybeSingle();

  if (error) return NextResponse.json({ ok: false, error: "insert_failed" }, { status: 500 });
  return NextResponse.json({ ok: true, confirmation });
}
