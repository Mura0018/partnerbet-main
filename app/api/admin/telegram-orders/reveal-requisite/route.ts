import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { recordRequisiteReveal } from "@/lib/payments/pickRequisite";
import { getClientIp } from "@/lib/security/rateLimit";

async function requireOrdersManage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, status: 401 };
  const { data: allowed } = await supabase.rpc("has_permission", { perm_key: "telegram_orders.manage" });
  if (!allowed) return { ok: false as const, status: 403 };
  return { ok: true as const, userId: user.id };
}

// W2 qo'shimcha: withdraw buyurtmasining rekvizitini (qabul qiluvchi
// hisob raqami) mas'ul operator ResolveModal'da OCHGANIDA (ko'rganida)
// shu yerga qayd etiladi — requisite_reveals topup uchun ham, withdraw
// uchun ham bir xil "har ko'rsatish qayd etiladi" jadvali.
export async function POST(req: NextRequest) {
  const check = await requireOrdersManage();
  if (!check.ok) return NextResponse.json({ error: "forbidden" }, { status: check.status });

  const body = await req.json().catch(() => null);
  const { orderId } = body ?? {};
  if (!orderId) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  const admin = createAdminClient();
  const { data: order } = await admin
    .from("telegram_orders")
    .select("id, type, customer_id, payment_method, payout_details, recipient_name")
    .eq("id", orderId)
    .maybeSingle();

  if (!order || (order as any).type !== "withdraw" || !(order as any).payout_details) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  try {
    await recordRequisiteReveal({
      customerId: (order as any).customer_id,
      orderId: (order as any).id,
      methodType: (order as any).payment_method,
      picked: {
        accountNumber: (order as any).payout_details,
        holderName: (order as any).recipient_name,
        operatorId: check.userId,
        partnerId: null,
        methodRowId: "",
        isPartner: false,
      },
      ip: getClientIp(req.headers),
    });
  } catch {
    /* audit best-effort — ko'rsatishni bloklamaydi */
  }

  return NextResponse.json({ ok: true });
}
