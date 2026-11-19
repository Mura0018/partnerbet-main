import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { ensureReplyOwnership, SUPPORT_OVERRIDE_PERMISSION } from "@/lib/support/ownership";
import { resetSupportNoticeFlags } from "@/lib/support/messages";
import { sendTelegramMessage, buildSupportReplyMessage } from "@/lib/telegram/notify";

async function requireOrdersManage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, status: 401 };

  const { data: allowed } = await supabase.rpc("has_permission", { perm_key: "telegram_orders.manage" });
  if (!allowed) return { ok: false as const, status: 403 };
  // Rahbar (telegram_operators.manage) boshqa operator suhbatiga ham javob bera oladi.
  const { data: canOverride } = await supabase.rpc("has_permission", { perm_key: SUPPORT_OVERRIDE_PERMISSION });

  return { ok: true as const, userId: user.id, canOverride: !!canOverride };
}

// Routed through here (not a direct client insert) so a reply always also
// pushes a Telegram message to the customer — the Mini App only polls its
// own thread, it isn't listening for realtime DB changes.
export async function POST(req: NextRequest) {
  const check = await requireOrdersManage();
  if (!check.ok) return NextResponse.json({ error: "forbidden" }, { status: check.status });

  const body = await req.json().catch(() => null);
  const { customerId, message, replyToId } = body ?? {};
  if (!customerId || !message || String(message).trim().length === 0) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const admin = createAdminClient();
  const text = String(message).trim().slice(0, 2000);

  // 3-band: egalik — egasi bo'lsa o'zi, egasiz bo'lsa atomik olinadi,
  // boshqanikiga faqat rahbar. Rad etilsa aniq xato (UI xabar ko'rsatadi).
  const own = await ensureReplyOwnership(admin, String(customerId), check.userId, check.canOverride);
  if (!own.ok) return NextResponse.json({ error: "not_owner", ownerName: own.ownerName }, { status: 409 });

  const { data: inserted, error } = await admin
    .from("telegram_support_messages")
    .insert({ customer_id: customerId, sender: "operator", operator_id: check.userId, message: text, reply_to_id: replyToId ?? null })
    .select("id, created_at")
    .single();

  if (error || !inserted) return NextResponse.json({ error: "insert_failed" }, { status: 500 });

  // Operator javob berdi:
  //  - last_operator_reply_at (0057 dan bor, lekin hech qayerda YOZILMASDI —
  //    shu sababli cron operator javob bergan suhbatni ham 15 daq'da olib
  //    qo'yardi; endi "javobsiz" hisobi va stale tekshiruvi to'g'ri);
  //  - "band" ogohlantirishi va operator bildirishnomasi belgilari tozalanadi
  //    (1.1 / 2.1) — keyingi uzilishda yana bir marta, hisob qaytadan.
  try {
    const replyNow = new Date().toISOString();
    await admin
      .from("telegram_support_threads")
      .update({ last_operator_reply_at: replyNow, updated_at: replyNow })
      .eq("customer_id", customerId);
  } catch {
    /* best-effort */
  }
  await resetSupportNoticeFlags(admin, customerId);

  const { data: customer } = await admin.from("customers").select("telegram_id").eq("id", customerId).maybeSingle();
  if (customer?.telegram_id) {
    await sendTelegramMessage(customer.telegram_id, buildSupportReplyMessage(text));
  }

  return NextResponse.json({ success: true, claimedNow: own.claimedNow });
}
