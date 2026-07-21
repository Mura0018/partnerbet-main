import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";

// How long an operator can sit on a claimed order before the team gets
// pinged about it.
const STALE_MINUTES = 15;

// This route is meant to be hit every 10-15 minutes by an external
// scheduler (Vercel Hobby's cron only runs once/day, too infrequent for
// this) — see the CRON_CHECK_SECRET env var, which must match the
// `?secret=` query param so this can't be triggered by randoms hitting
// the public URL and spamming the team chat.
export async function GET(req: NextRequest) {
  const expected = process.env.CRON_CHECK_SECRET;
  const provided = req.nextUrl.searchParams.get("secret");
  if (!expected || provided !== expected) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();
  const staleThreshold = new Date(Date.now() - STALE_MINUTES * 60 * 1000).toISOString();

  const { data: staleOrders } = await admin
    .from("telegram_orders")
    .select("id, type, amount, claimed_by, claimed_at")
    .eq("status", "pending")
    .not("claimed_by", "is", null)
    .lt("claimed_at", staleThreshold)
    .is("claim_escalated_at", null);

  if (!staleOrders || staleOrders.length === 0) {
    return NextResponse.json({ escalated: 0 });
  }

  const { data: profiles } = await admin.from("profiles").select("id, full_name, display_name, roles(key)").eq("is_active", true);
  const superAdmin = (profiles ?? []).find((p: any) => p.roles?.key === "super_admin");
  if (!superAdmin) return NextResponse.json({ escalated: 0, error: "no_super_admin_to_post_as" });

  const nameById = new Map((profiles ?? []).map((p: any) => [p.id, p.display_name || p.full_name || "Operator"]));

  let count = 0;
  for (const order of staleOrders) {
    const opName = nameById.get(order.claimed_by) ?? "Operator";
    const typeLabel = order.type === "topup" ? "Hisob to'ldirish" : "Pul yechish";
    const minutesAgo = Math.round((Date.now() - new Date(order.claimed_at as string).getTime()) / 60000);

    await admin.from("team_chat_messages").insert({
      sender_id: superAdmin.id,
      message: `🔔 Tizim: ${opName} ${typeLabel} buyurtmasini (${Number(order.amount).toLocaleString("ru-RU")} so'm) ${minutesAgo} daqiqadan beri ko'rib chiqmayapti. Unga xabar bering yoki boshqa operator ushlab olsin!`,
    });

    await admin.from("telegram_orders").update({ claim_escalated_at: new Date().toISOString() }).eq("id", order.id);
    count++;
  }

  return NextResponse.json({ escalated: count });
}
