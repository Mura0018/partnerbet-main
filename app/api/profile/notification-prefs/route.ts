import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseServer";

// Shaxsiy Telegram bildirishnoma sozlamalari (har kim faqat o'zinikini).
// Mavjud kontrakt: notifyOrders + notifySecurity birga (ikkalasi boolean).
// 6b: notifyCashdeskLow — ixtiyoriy, alohida yuborilishi mumkin. Faqat
// berilgan maydonlar yangilanadi (0102 qo'yilmagan bo'lsa ham eski ikki
// toggle ishlayveradi — ularning so'rovida yangi ustun yo'q).
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "forbidden" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const { notifyOrders, notifySecurity, notifyCashdeskLow } = body ?? {};

  const hasPair = notifyOrders !== undefined || notifySecurity !== undefined;
  if (hasPair && (typeof notifyOrders !== "boolean" || typeof notifySecurity !== "boolean")) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  if (notifyCashdeskLow !== undefined && typeof notifyCashdeskLow !== "boolean") {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  if (!hasPair && notifyCashdeskLow === undefined) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const patch: Record<string, boolean> = {};
  if (hasPair) {
    patch.notify_orders = notifyOrders;
    patch.notify_security = notifySecurity;
  }
  if (notifyCashdeskLow !== undefined) patch.notify_cashdesk_low = notifyCashdeskLow;

  const { error } = await supabase.from("profiles").update(patch).eq("id", user.id);
  if (error) return NextResponse.json({ error: "save_failed" }, { status: 500 });
  return NextResponse.json({ success: true });
}
