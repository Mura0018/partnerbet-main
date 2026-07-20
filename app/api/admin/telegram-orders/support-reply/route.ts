import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { sendTelegramMessage, buildSupportReplyMessage } from "@/lib/telegram/notify";

async function requireOrdersManage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, status: 401 };

  const { data: allowed } = await supabase.rpc("has_permission", { perm_key: "telegram_orders.manage" });
  if (!allowed) return { ok: false as const, status: 403 };

  return { ok: true as const, userId: user.id };
}

// Routed through here (not a direct client insert) so a reply always also
// pushes a Telegram message to the customer — the Mini App only polls its
// own thread, it isn't listening for realtime DB changes.
export async function POST(req: NextRequest) {
  const check = await requireOrdersManage();
  if (!check.ok) return NextResponse.json({ error: "forbidden" }, { status: check.status });

  const body = await req.json().catch(() => null);
  const { customerId, message } = body ?? {};
  if (!customerId || !message || String(message).trim().length === 0) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const admin = createAdminClient();
  const text = String(message).trim().slice(0, 2000);

  const { data: inserted, error } = await admin
    .from("telegram_support_messages")
    .insert({ customer_id: customerId, sender: "operator", operator_id: check.userId, message: text })
    .select("id, created_at")
    .single();

  if (error || !inserted) return NextResponse.json({ error: "insert_failed" }, { status: 500 });

  const { data: customer } = await admin.from("customers").select("telegram_id").eq("id", customerId).maybeSingle();
  if (customer?.telegram_id) {
    await sendTelegramMessage(customer.telegram_id, buildSupportReplyMessage(text));
  }

  return NextResponse.json({ success: true });
}
