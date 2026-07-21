import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseServer";

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "forbidden" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const { notifyOrders, notifySecurity } = body ?? {};
  if (typeof notifyOrders !== "boolean" || typeof notifySecurity !== "boolean") {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  await supabase.from("profiles").update({ notify_orders: notifyOrders, notify_security: notifySecurity }).eq("id", user.id);
  return NextResponse.json({ success: true });
}
