import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";

// customers.manage (admin/customers sahifasi) YOKI telegram_orders.manage
// (BetCore operatori, buyurtma yaratishda bloklanishga duch keladi) —
// ikkalasidan biri yetarli.
async function requireAccess() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, status: 401 };

  const [{ data: canCustomers }, { data: canOrders }] = await Promise.all([
    supabase.rpc("has_permission", { perm_key: "customers.manage" }),
    supabase.rpc("has_permission", { perm_key: "telegram_orders.manage" }),
  ]);
  if (!canCustomers && !canOrders) return { ok: false as const, status: 403 };

  return { ok: true as const, userId: user.id };
}

// W1.4: ism mos kelmagani sababli bloklangan buyurtma urinishlari
// ro'yxati (kutilayotgan — hali qaror qabul qilinmagan).
export async function GET() {
  const check = await requireAccess();
  if (!check.ok) return NextResponse.json({ error: "forbidden" }, { status: check.status });

  const admin = createAdminClient();
  const { data } = await admin
    .from("name_mismatch_flags")
    .select("id, customer_id, registered_name, player_name, platform, account_id, status, created_at, customers(phone, full_name)")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(100);

  return NextResponse.json({ flags: data ?? [] });
}

// Operator (yoki super_admin) "bu haqiqatan shu mijoz" deb qo'lda
// tasdiqlaydi. MAJBURIY: sabab yozilishi shart — kim/qachon (server
// tomonidan, auth'dan) va sababi customers'ga qayd etiladi. Tasdiqdan
// keyin shu mijoz uchun ism-tekshiruvi kelgusida o'tkazib yuboriladi.
export async function POST(req: NextRequest) {
  const check = await requireAccess();
  if (!check.ok) return NextResponse.json({ error: "forbidden" }, { status: check.status });

  const body = await req.json().catch(() => null);
  const { customerId, reason } = body ?? {};
  if (!customerId || !reason || !String(reason).trim()) {
    return NextResponse.json({ error: "reason_required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("customers")
    .update({
      name_override_by: check.userId,
      name_override_at: new Date().toISOString(),
      name_override_reason: String(reason).trim().slice(0, 500),
    })
    .eq("id", customerId);
  if (error) return NextResponse.json({ error: "update_failed" }, { status: 500 });

  await admin.from("name_mismatch_flags").update({ status: "resolved" }).eq("customer_id", customerId).eq("status", "pending");

  return NextResponse.json({ success: true });
}
